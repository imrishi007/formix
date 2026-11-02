"""Immutable form release history, environment promotion, and rollback."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..deps import get_form_or_403
from ..models import Form, FormRelease, FormView, User
from ..schemas import FormReleaseResponse, PublicFormResponse, PublishResponse, RollbackRequest


router = APIRouter(tags=["releases"])


def _release_response(form: Form, release: FormRelease) -> FormReleaseResponse:
    active_in = []
    if form.active_preview_release_id == release.id:
        active_in.append("preview")
    if form.active_production_release_id == release.id:
        active_in.append("production")
    return FormReleaseResponse(
        id=release.id,
        form_id=release.form_id,
        version=release.version,
        note=release.note,
        created_by_id=release.created_by_id,
        created_at=release.created_at,
        active_in=active_in,
    )


@router.get("/forms/{form_id}/releases", response_model=list[FormReleaseResponse])
def list_releases(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db)
    releases = (
        db.query(FormRelease)
        .filter(FormRelease.form_id == form.id)
        .order_by(FormRelease.version.desc())
        .all()
    )
    return [_release_response(form, release) for release in releases]


@router.post("/forms/{form_id}/rollback", response_model=PublishResponse)
def rollback_release(
    form_id: str,
    body: RollbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = get_form_or_403(form_id, current_user, db, "editor")
    release = db.query(FormRelease).filter(
        FormRelease.id == body.release_id, FormRelease.form_id == form.id,
    ).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    if body.environment == "preview":
        form.active_preview_release_id = release.id
        if not form.preview_token:
            import secrets
            form.preview_token = secrets.token_urlsafe(32)
    else:
        form.active_production_release_id = release.id
        form.is_published = True
    db.commit()

    base = body.base_url.rstrip("/")
    public_url = (
        f"{base}/preview/f/{form.id}?token={form.preview_token}"
        if body.environment == "preview"
        else f"{base}/f/{form.id}"
    )
    return PublishResponse(
        form_id=form.id,
        public_url=public_url,
        embed_snippet=f'<div data-formix-form="{form.id}"></div><script async src="{base}/formix-embed.js"></script>',
        environment=body.environment,
        release_id=release.id,
        version=release.version,
    )


@router.get("/forms/{form_id}/preview", response_model=PublicFormResponse)
def preview_form(
    form_id: str,
    token: str = Query(...),
    session: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    form = db.query(Form).filter(Form.id == form_id, Form.preview_token == token).first()
    if not form or not form.active_preview_release_id:
        raise HTTPException(status_code=404, detail="Preview not found")
    release = db.query(FormRelease).filter(FormRelease.id == form.active_preview_release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Preview release not found")

    session_id = session or str(uuid.uuid4())
    if not session:
        db.add(FormView(form_id=form.id, session_id=session_id))
        db.commit()
    return PublicFormResponse(
        id=form.id,
        title=form.title,
        compiled_schema=release.compiled_schema,
        session_id=session_id,
        release_id=release.id,
        version=release.version,
    )
