"""
backend/routers/forms.py
Form-related endpoints for the Formix API.

Public routes (no auth — any respondent can call these):
  GET  /forms/{form_id}                       — fetch compiled schema; mints session_id
  POST /forms/{form_id}/submit                — submit answers; stores session_id
  GET  /submissions/by-session/{session_id}   — all submissions for a session

Author-only routes (unchanged from v1 except publish now updates a form that
must already exist inside a project):
  PUT  /forms/{form_id}                       — update forml source / compiled schema
  POST /forms/{form_id}/publish               — mark as published
  GET  /forms/{form_id}/responses             — list all submissions for a form
"""

import logging
import uuid
from typing import Any, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, Submission
from ..schemas import (
    FormUpdate,
    PublicFormResponse,
    PublishRequest,
    PublishResponse,
    SubmissionRecord,
    SubmitRequest,
    SubmitResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["forms"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_unconditional_required_fields(schema: Any) -> list[str]:
    """
    Returns field names that are ALL of the following:
      1. Direct children of schema.statements or schema.pages[*].statements
      2. NOT wrapped inside any Conditional node (those are skipped entirely)
      3. Have validate.required == True in the compiled schema

    POLICY: We validate required fields unconditionally — we do NOT re-evaluate
    `when` / conditional visibility server-side.  A field inside an `if` block
    that the respondent never saw will still be in compiled_schema; if we naively
    required it we would reject valid submissions where the conditional branch was
    never triggered.

    TO FIX THIS PROPERLY: the frontend should either:
      (a) strip non-visible field keys from `data` before POSTing, or
      (b) send an explicit `visible_fields: [...]` list alongside `data` for the
          backend to intersect against.

    For now we only validate fields that appear as direct children of the root
    (or inside Section nodes, which are structural not conditional).  Fields
    inside Conditional nodes are skipped.  This is conservative and correct: it
    will never reject a valid submission, but it will not enforce required-ness
    on conditional fields.
    """
    required: list[str] = []

    def walk(stmts: list, inside_conditional: bool = False) -> None:
        for stmt in stmts:
            if not isinstance(stmt, dict):
                continue
            node_type = stmt.get("type")

            if node_type == "Field" and not inside_conditional:
                validate = stmt.get("validate") or {}
                if isinstance(validate, dict) and validate.get("required"):
                    name = stmt.get("name")
                    if name:
                        required.append(str(name))

            elif node_type == "Section":
                walk(stmt.get("statements") or [], inside_conditional)

            elif node_type == "Conditional":
                pass  # intentionally skip — see policy note above

            elif node_type == "RepeatGroup":
                pass  # dynamic count; skip server-side required validation

    if not isinstance(schema, dict):
        return required

    all_stmts: list = list(schema.get("statements") or [])
    for page in (schema.get("pages") or []):
        if isinstance(page, dict):
            all_stmts.extend(page.get("statements") or [])

    walk(all_stmts)
    return required


async def _fire_webhook(url: str, payload: dict) -> None:
    """
    Fire-and-forget HTTP POST to the author-specified `on submit` endpoint.
    Failures are logged but never surfaced to the respondent.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            logger.info("Webhook %s → HTTP %s", url, resp.status_code)
    except Exception as exc:
        logger.warning("Webhook to %s failed: %s", url, exc)


# ── Public respondent routes ──────────────────────────────────────────────────

@router.get("/forms/{form_id}", response_model=PublicFormResponse)
def get_form(
    form_id: str,
    session: Optional[str] = Query(default=None, description="Existing respondent session ID"),
    db: Session = Depends(get_db),
):
    """
    Fetch a published form's compiled schema.

    Session handling:
      - If ?session=<uuid> is provided in the query string, echo it back unchanged
        so a respondent moving through a multi-form flow keeps the same session.
      - If absent, mint a new random UUID as the session_id and return it.

    Only returns data if is_published is True; 404 otherwise.
    """
    form = db.query(Form).filter(Form.id == form_id, Form.is_published == True).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found or not published")

    session_id = session if session else str(uuid.uuid4())

    return PublicFormResponse(
        id=form.id,
        title=form.title,
        compiled_schema=form.compiled_schema,
        session_id=session_id,
    )


@router.post("/forms/{form_id}/submit", response_model=SubmitResponse)
async def submit_form(
    form_id: str,
    body: SubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Accept a respondent's submission.

    Validation:
      - The form must be published.
      - Unconditionally required fields must be present and non-blank.

    Session + sequential flow:
      - Store body.session_id on the Submission row (may be None for old clients).
      - If Form.next_form_id is set, include it + session_id in the response so
        the respondent page can navigate to the next form.
      - If Form.next_form_id is None, omit those fields from the response.

    On success:
      1. Insert a Submission row.
      2. If the compiled schema has an `action.endpoint`, fire a background
         HTTP POST to that URL — fire-and-forget, failures are logged only.
      3. Return the appropriate SubmitResponse.
    """
    form = db.query(Form).filter(Form.id == form_id, Form.is_published == True).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found or not published")

    # ── Required-field validation ──────────────────────────────────────────────
    if form.compiled_schema:
        required_fields = _get_unconditional_required_fields(form.compiled_schema)
        missing = [
            f for f in required_fields
            if not str(body.data.get(f, "")).strip()
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required fields: {', '.join(missing)}",
            )

    # ── Persist submission ─────────────────────────────────────────────────────
    submission = Submission(
        form_id=form_id,
        respondent_session_id=body.session_id,
        data=body.data,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # ── Fire webhook (fire-and-forget) ─────────────────────────────────────────
    action = (form.compiled_schema or {}).get("action") if form.compiled_schema else None
    webhook_url = action.get("endpoint") if isinstance(action, dict) else None

    if webhook_url:
        background_tasks.add_task(
            _fire_webhook,
            url=str(webhook_url),
            payload={
                "form_id": form_id,
                "submission_id": submission.id,
                "data": body.data,
            },
        )

    # ── Build response ─────────────────────────────────────────────────────────
    if form.next_form_id:
        return SubmitResponse(
            success=True,
            submission_id=submission.id,
            next_form_id=form.next_form_id,
            session_id=body.session_id,
        )
    return SubmitResponse(success=True, submission_id=submission.id)


@router.get(
    "/submissions/by-session/{session_id}",
    response_model=list[SubmissionRecord],
)
def submissions_by_session(session_id: str, db: Session = Depends(get_db)):
    """
    Return all Submission rows for a given respondent session, ordered by
    submitted_at ascending (chronological order of form completion).

    Public route — the session UUID is itself the access control token.
    No auth required.
    """
    submissions = (
        db.query(Submission)
        .filter(Submission.respondent_session_id == session_id)
        .order_by(Submission.submitted_at.asc())
        .all()
    )
    return submissions


# ── Author routes (existing, unchanged logic) ─────────────────────────────────

@router.put("/forms/{form_id}", status_code=200)
def update_form(form_id: str, body: FormUpdate, db: Session = Depends(get_db)):
    """
    Update an existing form's source and compiled schema.
    Called when the author edits after the form was already created in the DB.
    Note: no auth guard here yet — auth on author routes is a separate TODO
    (see project ownership checks in projects.py for new forms).
    """
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    form.forml_source = body.forml_source
    if body.compiled_schema is not None:
        form.compiled_schema = body.compiled_schema
    db.commit()
    return {"ok": True}


@router.post("/forms/{form_id}/publish", response_model=PublishResponse)
def publish_form(form_id: str, body: PublishRequest, db: Session = Depends(get_db)):
    """
    Mark a form as published and store the final compiled schema.

    The frontend runs the WASM compiler one last time and sends the resulting
    JSON AST here — we do NOT recompile FormL server-side.
    Returns the public URL and iframe embed snippet.
    """
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    form.compiled_schema = body.compiled_schema
    form.is_published = True
    db.commit()

    base = body.base_url.rstrip("/")
    public_url = f"{base}/f/{form_id}"
    embed_snippet = (
        f'<iframe src="{public_url}" '
        f'width="100%" height="600" frameborder="0" '
        f'style="border:none;"></iframe>'
    )
    return PublishResponse(
        form_id=form_id,
        public_url=public_url,
        embed_snippet=embed_snippet,
    )


@router.get("/forms/{form_id}/responses", response_model=list[SubmissionRecord])
def list_responses(form_id: str, db: Session = Depends(get_db)):
    """
    List all submissions for a form (author-only view).
    No auth enforcement here — ownership check via projects router for new forms.
    """
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    submissions = (
        db.query(Submission)
        .filter(Submission.form_id == form_id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return submissions
