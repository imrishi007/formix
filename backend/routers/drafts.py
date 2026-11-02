"""Anonymous save-and-resume endpoints using unguessable bearer tokens."""

import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, FormDraft
from ..schemas import DraftResponse, DraftSaveRequest


router = APIRouter(tags=["drafts"])
MAX_DRAFT_BYTES = 1_000_000


def _response(draft: FormDraft) -> DraftResponse:
    return DraftResponse(
        resume_token=draft.resume_token,
        data=draft.data,
        current_page=draft.current_page,
        expires_at=draft.expires_at,
    )


@router.put("/forms/{form_id}/draft", response_model=DraftResponse)
def save_draft(form_id: str, body: DraftSaveRequest, db: Session = Depends(get_db)):
    form = db.query(Form).filter(Form.id == form_id, Form.is_published.is_(True)).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found or not published")
    if not 0 <= body.current_page <= 1000:
        raise HTTPException(status_code=422, detail="Invalid page index")
    if len(json.dumps(body.data, separators=(",", ":")).encode()) > MAX_DRAFT_BYTES:
        raise HTTPException(status_code=413, detail="Draft is too large")

    draft = None
    if body.resume_token:
        draft = db.query(FormDraft).filter(
            FormDraft.resume_token == body.resume_token,
            FormDraft.form_id == form.id,
        ).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Saved draft not found")
    if draft is None:
        draft = FormDraft(
            form_id=form.id,
            release_id=form.active_production_release_id,
            resume_token=secrets.token_urlsafe(48),
            data={},
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(draft)

    draft.data = body.data
    draft.current_page = body.current_page
    draft.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    db.commit()
    db.refresh(draft)
    return _response(draft)


@router.get("/forms/{form_id}/draft/{resume_token}", response_model=DraftResponse)
def get_draft(form_id: str, resume_token: str, db: Session = Depends(get_db)):
    draft = db.query(FormDraft).filter(
        FormDraft.form_id == form_id,
        FormDraft.resume_token == resume_token,
        FormDraft.expires_at >= datetime.now(timezone.utc),
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Saved draft not found or expired")
    return _response(draft)


@router.delete("/forms/{form_id}/draft/{resume_token}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(form_id: str, resume_token: str, db: Session = Depends(get_db)):
    draft = db.query(FormDraft).filter(
        FormDraft.form_id == form_id,
        FormDraft.resume_token == resume_token,
    ).first()
    if draft:
        db.delete(draft)
        db.commit()
