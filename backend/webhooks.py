"""Durable signed webhook delivery shared by submission routes and the worker."""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

from .database import SessionLocal
from .models import Submission, WebhookDelivery, WebhookEndpoint


log = logging.getLogger("formix.webhooks")
MAX_ATTEMPTS = 5


def enqueue_webhooks(submission: Submission, db) -> list[str]:
    """Persist before sending so a process restart cannot erase the event."""
    endpoints = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.form_id == submission.form_id,
        WebhookEndpoint.enabled.is_(True),
    ).all()
    ids: list[str] = []
    for endpoint in endpoints:
        payload = {
            "event": "submission.created",
            "form_id": submission.form_id,
            "release_id": submission.form_release_id,
            "submission_id": submission.id,
            "submitted_at": submission.submitted_at.isoformat(),
            "data": submission.data,
        }
        delivery = WebhookDelivery(
            webhook_id=endpoint.id,
            submission_id=submission.id,
            payload=payload,
            status="pending",
        )
        db.add(delivery)
        db.flush()
        ids.append(delivery.id)
    return ids


async def deliver_webhook_delivery(delivery_id: str) -> None:
    db = SessionLocal()
    try:
        delivery = db.query(WebhookDelivery).filter(WebhookDelivery.id == delivery_id).first()
        if not delivery or delivery.status == "delivered":
            return
        endpoint = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == delivery.webhook_id).first()
        if not endpoint or not endpoint.enabled:
            delivery.status = "disabled"
            db.commit()
            return

        body = json.dumps(delivery.payload, separators=(",", ":"), sort_keys=True).encode()
        timestamp = str(int(datetime.now(timezone.utc).timestamp()))
        signature = hmac.new(endpoint.secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
        delivery.attempt_count += 1
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
                response = await client.post(
                    endpoint.url,
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "Formix-Webhooks/1.0",
                        "X-Formix-Event": delivery.event,
                        "X-Formix-Delivery": delivery.id,
                        "X-Formix-Timestamp": timestamp,
                        "X-Formix-Signature": f"sha256={signature}",
                    },
                )
            delivery.response_status = response.status_code
            if 200 <= response.status_code < 300:
                delivery.status = "delivered"
                delivery.delivered_at = datetime.now(timezone.utc)
                delivery.last_error = None
                delivery.next_attempt_at = None
            else:
                delivery.last_error = f"HTTP {response.status_code}"
        except Exception as exc:  # network failures must remain replayable
            delivery.last_error = str(exc)[:2000]

        if delivery.status != "delivered":
            if delivery.attempt_count >= MAX_ATTEMPTS:
                delivery.status = "failed"
                delivery.next_attempt_at = None
            else:
                delivery.status = "retrying"
                delay_minutes = 2 ** (delivery.attempt_count - 1)
                delivery.next_attempt_at = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
        db.commit()
    finally:
        db.close()


async def webhook_retry_worker(stop: asyncio.Event) -> None:
    """Small database-backed worker; upgrade to a queue when traffic requires it."""
    # ponytail: one worker polls 50 deliveries at a time; move this unchanged
    # delivery function behind a managed queue once sustained volume needs
    # horizontal worker scaling.
    while not stop.is_set():
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            ids = [row[0] for row in (
                db.query(WebhookDelivery.id)
                .filter(
                    WebhookDelivery.status.in_(("pending", "retrying")),
                    (WebhookDelivery.next_attempt_at.is_(None)) | (WebhookDelivery.next_attempt_at <= now),
                )
                .limit(50)
                .all()
            )]
        except Exception as exc:
            log.warning("Webhook retry poll failed: %s", exc)
            ids = []
        finally:
            db.close()
        for delivery_id in ids:
            await deliver_webhook_delivery(delivery_id)
        try:
            await asyncio.wait_for(stop.wait(), timeout=30)
        except asyncio.TimeoutError:
            pass
