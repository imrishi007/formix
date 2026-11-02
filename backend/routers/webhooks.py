"""Author endpoints for signed webhook configuration, logs, and replay."""

import ipaddress
import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..deps import get_form_or_403
from ..models import User, WebhookDelivery, WebhookEndpoint
from ..schemas import WebhookCreate, WebhookDeliveryResponse, WebhookResponse
from ..webhooks import deliver_webhook_delivery


router = APIRouter(tags=["webhooks"])


def _validate_url(raw: str) -> str:
    url = raw.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="Webhook URL must be an absolute HTTP(S) URL without credentials")
    if parsed.fragment:
        raise HTTPException(status_code=422, detail="Webhook URL cannot contain a fragment")
    hostname = parsed.hostname.lower()
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise HTTPException(status_code=422, detail="Webhook URL cannot target localhost")
    try:
        ip = ipaddress.ip_address(hostname)
        if not ip.is_global:
            raise HTTPException(status_code=422, detail="Webhook URL cannot target a private network")
    except ValueError:
        pass
    return url


def _response(endpoint: WebhookEndpoint, include_secret: bool = False) -> WebhookResponse:
    return WebhookResponse(
        id=endpoint.id,
        form_id=endpoint.form_id,
        url=endpoint.url,
        enabled=endpoint.enabled,
        secret=endpoint.secret if include_secret else None,
        created_at=endpoint.created_at,
    )


@router.get("/forms/{form_id}/webhooks", response_model=list[WebhookResponse])
def list_webhooks(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db)
    return [_response(endpoint) for endpoint in form.webhooks]


@router.post("/forms/{form_id}/webhooks", response_model=WebhookResponse, status_code=201)
def create_webhook(
    form_id: str,
    body: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db, "editor")
    endpoint = WebhookEndpoint(
        form_id=form.id,
        url=_validate_url(body.url),
        secret=secrets.token_hex(32),
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return _response(endpoint, include_secret=True)


@router.patch("/forms/{form_id}/webhooks/{webhook_id}", response_model=WebhookResponse)
def toggle_webhook(
    form_id: str,
    webhook_id: str,
    enabled: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db, "editor")
    endpoint = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == webhook_id, WebhookEndpoint.form_id == form.id,
    ).first()
    if not endpoint:
        raise HTTPException(status_code=404, detail="Webhook not found")
    endpoint.enabled = enabled
    db.commit()
    db.refresh(endpoint)
    return _response(endpoint)


@router.delete("/forms/{form_id}/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    form_id: str,
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db, "editor")
    endpoint = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == webhook_id, WebhookEndpoint.form_id == form.id,
    ).first()
    if not endpoint:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(endpoint)
    db.commit()


@router.get("/forms/{form_id}/webhook-deliveries", response_model=list[WebhookDeliveryResponse])
def list_deliveries(
    form_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db)
    return (
        db.query(WebhookDelivery)
        .join(WebhookEndpoint, WebhookEndpoint.id == WebhookDelivery.webhook_id)
        .filter(WebhookEndpoint.form_id == form.id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/forms/{form_id}/webhook-deliveries/{delivery_id}/replay", status_code=202)
def replay_delivery(
    form_id: str,
    delivery_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db, "editor")
    delivery = (
        db.query(WebhookDelivery)
        .join(WebhookEndpoint, WebhookEndpoint.id == WebhookDelivery.webhook_id)
        .filter(WebhookDelivery.id == delivery_id, WebhookEndpoint.form_id == form.id)
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Webhook delivery not found")
    delivery.status = "pending"
    delivery.attempt_count = 0
    delivery.next_attempt_at = None
    delivery.last_error = None
    db.commit()
    background_tasks.add_task(deliver_webhook_delivery, delivery.id)
    return {"ok": True}
