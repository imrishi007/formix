"""
backend/routers/forms.py
Form-related endpoints for the Formix API.

Public routes (no auth — any respondent can call these):
  GET  /forms/{form_id}                       — fetch compiled schema; mints session_id
<<<<<<< HEAD
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
=======
  POST /forms/{form_id}/submit                — submit answers (JSON, no files); stores session_id
  POST /forms/{form_id}/submit-multipart      — submit answers including uploaded files
  GET  /submissions/by-session/{session_id}   — all submissions for a session

Author-only routes (Bearer-auth guarded; caller must own the form's project):
  PUT    /forms/{form_id}                       — update forml source / compiled schema
  POST   /forms/{form_id}/publish               — mark as published
  GET    /forms/{form_id}/responses             — list all submissions for a form
  GET    /forms/{form_id}/responses/{sub_id}    — fetch a single submission
  DELETE /forms/{form_id}/responses             — bulk-delete all submissions for a form
"""

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
# `request.form()` returns Starlette's base UploadFile, not fastapi.UploadFile
# (a subclass) — isinstance() against the fastapi one never matches a value
# that came from a raw form-data parse, so we check against the base class.
from starlette.datastructures import UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..deps import get_form_or_403
from ..models import Form, Submission, User
>>>>>>> f6620dd (Complete Formix updates)
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

<<<<<<< HEAD

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_unconditional_required_fields(schema: Any) -> list[str]:
    """
    Returns field names that are ALL of the following:
      1. Direct children of schema.statements or schema.pages[*].statements
      2. NOT wrapped inside any Conditional node (those are skipped entirely)
      3. Have validate.required == True in the compiled schema
=======
# "upload" is the canonical upload field type (forml-compiler's semantic
# analyzer normalizes file/image/pdf/document into it at compile time); the
# legacy names are kept here too so forms compiled before that normalization
# shipped — whose stored compiled_schema still has the old fieldType string —
# keep working without needing to be re-saved.
FILE_FIELD_TYPES = {"upload", "file", "image", "pdf", "document"}

# Respondent-uploaded files are written here, one subfolder per form.
UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_unconditional_required_fields(schema: Any) -> dict[str, str]:
    """
    Returns {field_name: fieldType} for every field that is ALL of the following:
      1. Direct children of schema.statements or schema.pages[*].statements
      2. NOT wrapped inside any Conditional node (those are skipped entirely)
      3. Have validation.required == True in the compiled schema
>>>>>>> f6620dd (Complete Formix updates)

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
<<<<<<< HEAD
    """
    required: list[str] = []
=======

    fieldType is returned alongside the name because required-ness is checked
    differently for upload fields (data holds a list of file-metadata dicts,
    not a string — see `_is_missing_required_value`).
    """
    required: dict[str, str] = {}
>>>>>>> f6620dd (Complete Formix updates)

    def walk(stmts: list, inside_conditional: bool = False) -> None:
        for stmt in stmts:
            if not isinstance(stmt, dict):
                continue
            node_type = stmt.get("type")

            if node_type == "Field" and not inside_conditional:
<<<<<<< HEAD
                validate = stmt.get("validate") or {}
                if isinstance(validate, dict) and validate.get("required"):
                    name = stmt.get("name")
                    if name:
                        required.append(str(name))
=======
                field_type = str(stmt.get("fieldType") or "text")
                # Upload fields carry `required` inside their own `upload`
                # block, not `validation` (see UploadBlockNode in the compiler).
                if field_type in FILE_FIELD_TYPES:
                    upload_cfg = stmt.get("upload") or {}
                    is_required = isinstance(upload_cfg, dict) and bool(upload_cfg.get("required"))
                else:
                    validation = stmt.get("validation") or {}
                    is_required = isinstance(validation, dict) and bool(validation.get("required"))
                if is_required:
                    name = stmt.get("name")
                    if name:
                        required[str(name)] = field_type
>>>>>>> f6620dd (Complete Formix updates)

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


<<<<<<< HEAD
=======
def _is_missing_required_value(field_type: str, value: Any) -> bool:
    """Upload fields store a list of file-metadata dicts in `data`; every
    other field type stores a plain string. "Missing" means different things
    for each shape, so required-field validation branches on fieldType."""
    if field_type in FILE_FIELD_TYPES:
        return not isinstance(value, list) or len(value) == 0
    return not str(value if value is not None else "").strip()


def _find_missing_required(schema: Any, data: dict) -> list[str]:
    required = _get_unconditional_required_fields(schema)
    return [
        name for name, field_type in required.items()
        if _is_missing_required_value(field_type, data.get(name))
    ]


>>>>>>> f6620dd (Complete Formix updates)
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


<<<<<<< HEAD
=======
def _persist_submission(
    form: Form,
    data: dict,
    session_id: Optional[str],
    background_tasks: BackgroundTasks,
    db: Session,
) -> SubmitResponse:
    """
    Shared tail end of both submit endpoints (JSON and multipart): insert the
    Submission row, fire the optional webhook, and build the response.
    """
    submission = Submission(form_id=form.id, respondent_session_id=session_id, data=data)
    db.add(submission)
    db.commit()
    db.refresh(submission)

    action = (form.compiled_schema or {}).get("action") if form.compiled_schema else None
    webhook_url = action.get("endpoint") if isinstance(action, dict) else None
    if webhook_url:
        background_tasks.add_task(
            _fire_webhook,
            url=str(webhook_url),
            payload={"form_id": form.id, "submission_id": submission.id, "data": data},
        )

    if form.next_form_id:
        return SubmitResponse(
            success=True,
            submission_id=submission.id,
            next_form_id=form.next_form_id,
            session_id=session_id,
        )
    return SubmitResponse(success=True, submission_id=submission.id)


>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
        required_fields = _get_unconditional_required_fields(form.compiled_schema)
        missing = [
            f for f in required_fields
            if not str(body.data.get(f, "")).strip()
        ]
=======
        missing = _find_missing_required(form.compiled_schema, body.data)
>>>>>>> f6620dd (Complete Formix updates)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required fields: {', '.join(missing)}",
            )

<<<<<<< HEAD
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
=======
    return _persist_submission(form, body.data, body.session_id, background_tasks, db)


@router.post("/forms/{form_id}/submit-multipart", response_model=SubmitResponse)
async def submit_form_multipart(
    form_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Accept a respondent's submission that includes one or more uploaded files
    (`field type: upload` — or a legacy file/image/pdf/document field from a
    schema compiled before that normalization shipped).

    The frontend only calls this instead of POST /forms/{id}/submit when the
    form's compiled schema contains at least one upload field — plain forms
    keep using the JSON endpoint above unchanged.

    Request shape (multipart/form-data):
      - "data"        : JSON-encoded {fieldName: value} for every non-file field
      - "session_id"  : optional respondent session id
      - "file__<fieldName>" : one part per selected file, repeated for multi-file fields

    Uploaded files are saved under backend/uploads/{form_id}/ with a random
    prefix (never trusting the original filename for the on-disk name), and
    stored in `data[fieldName]` as a list of {name, size, mimeType, url}
    dicts — never as raw bytes in the JSON column.

    We parse the multipart body manually via `request.form()` (rather than
    typed FastAPI parameters) because the set of file field names is dynamic,
    defined by the author's FormL schema, not known at route-definition time.
    """
    form = db.query(Form).filter(Form.id == form_id, Form.is_published == True).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found or not published")

    form_data = await request.form()

    raw_data = form_data.get("data")
    if not isinstance(raw_data, str):
        raise HTTPException(status_code=422, detail="Missing 'data' field")
    try:
        data: dict = json.loads(raw_data)
    except ValueError:
        raise HTTPException(status_code=422, detail="'data' must be valid JSON")

    session_id_raw = form_data.get("session_id")
    session_id = session_id_raw if isinstance(session_id_raw, str) and session_id_raw else None

    upload_dir = UPLOAD_ROOT / form_id
    file_meta: dict[str, list[dict]] = {}
    for key, value in form_data.multi_items():
        if not key.startswith("file__") or not isinstance(value, UploadFile):
            continue
        field_name = key[len("file__"):]
        content = await value.read()
        stored_name = f"{uuid.uuid4().hex}_{Path(value.filename or 'upload').name}"
        upload_dir.mkdir(parents=True, exist_ok=True)
        (upload_dir / stored_name).write_bytes(content)
        file_meta.setdefault(field_name, []).append({
            "name": value.filename or stored_name,
            "size": len(content),
            "mimeType": value.content_type,
            "url": f"/uploads/{form_id}/{stored_name}",
        })
    for field_name, metas in file_meta.items():
        data[field_name] = metas

    if form.compiled_schema:
        missing = _find_missing_required(form.compiled_schema, data)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required fields: {', '.join(missing)}",
            )

    return _persist_submission(form, data, session_id, background_tasks, db)
>>>>>>> f6620dd (Complete Formix updates)


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
<<<<<<< HEAD
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
=======
def update_form(
    form_id: str,
    body: FormUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing form's source and compiled schema.
    Called when the author edits after the form was already created in the DB.
    Auth-guarded: the requesting user must own the form's parent project.

    `title` is optional and only ever sent when the author explicitly accepts
    the workspace's rename suggestion — never inferred or changed implicitly.
    """
    form = get_form_or_403(form_id, current_user, db)
    form.forml_source = body.forml_source
    if body.compiled_schema is not None:
        form.compiled_schema = body.compiled_schema
    if body.title is not None and body.title.strip():
        form.title = body.title.strip()
>>>>>>> f6620dd (Complete Formix updates)
    db.commit()
    return {"ok": True}


@router.post("/forms/{form_id}/publish", response_model=PublishResponse)
<<<<<<< HEAD
def publish_form(form_id: str, body: PublishRequest, db: Session = Depends(get_db)):
=======
def publish_form(
    form_id: str,
    body: PublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
>>>>>>> f6620dd (Complete Formix updates)
    """
    Mark a form as published and store the final compiled schema.

    The frontend runs the WASM compiler one last time and sends the resulting
    JSON AST here — we do NOT recompile FormL server-side.
    Returns the public URL and iframe embed snippet.
<<<<<<< HEAD
    """
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
=======
    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)
>>>>>>> f6620dd (Complete Formix updates)

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
<<<<<<< HEAD
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
=======
def list_responses(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all submissions for a form (author-only view).
    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)

    submissions = (
        db.query(Submission)
        .filter(Submission.form_id == form.id)
>>>>>>> f6620dd (Complete Formix updates)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return submissions
<<<<<<< HEAD
=======


@router.get("/forms/{form_id}/responses/{submission_id}", response_model=SubmissionRecord)
def get_response(
    form_id: str,
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch a single submission (author-only view) — backs the "Open Submission"
    full-page tab, which needs one record rather than the whole list.
    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)

    submission = (
        db.query(Submission)
        .filter(Submission.form_id == form.id, Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.delete("/forms/{form_id}/responses", status_code=200)
def delete_all_responses(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk-delete every submission for a form.

    Used by the workspace's "Smart Rename" flow: when an author accepts a
    rename suggestion for a form that already has submissions, they may
    choose "Rename & Delete" — this endpoint clears the submissions first.
    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)

    deleted = (
        db.query(Submission)
        .filter(Submission.form_id == form.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "deleted": deleted}
>>>>>>> f6620dd (Complete Formix updates)
