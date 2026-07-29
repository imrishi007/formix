"""
backend/routers/forms.py
Form-related endpoints for the Formix API.

Public routes (no auth — any respondent can call these):
  GET  /forms/{form_id}                       — fetch compiled schema; mints session_id
  POST /forms/{form_id}/submit                — submit answers (JSON, no files); stores session_id
  POST /forms/{form_id}/submit-multipart      — submit answers including uploaded files
  GET  /submissions/by-session/{session_id}   — all submissions for a session

Author-only routes (Bearer-auth guarded; caller must own the form's project):
  PUT    /forms/{form_id}                       — update forml source / compiled schema
  POST   /forms/{form_id}/publish               — mark as published
  GET    /forms/{form_id}/responses             — list all submissions for a form
  GET    /forms/{form_id}/responses/{sub_id}    — fetch a single submission
  DELETE /forms/{form_id}/responses/{sub_id}    — delete a single submission
  DELETE /forms/{form_id}/responses             — bulk-delete all submissions for a form
"""

import csv
import io
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
# `request.form()` returns Starlette's base UploadFile, not fastapi.UploadFile
# (a subclass) — isinstance() against the fastapi one never matches a value
# that came from a raw form-data parse, so we check against the base class.
from starlette.datastructures import UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session
from user_agents import parse as parse_user_agent

from ..auth import get_current_user
from ..database import get_db
from ..deps import get_form_or_403
from ..models import (
    DUPLICATE_MODE_SINGLE_PER_EMAIL,
    DUPLICATE_MODE_SINGLE_PER_SESSION,
    Form,
    FormView,
    Submission,
    User,
)
from ..schemas import (
    AnalyticsDayCount,
    FieldAnalytics,
    FieldValueCount,
    FormAnalytics,
    FormCreateResponse,
    FormUpdate,
    PaginatedSubmissions,
    PublicFormResponse,
    PublishRequest,
    PublishResponse,
    SubmissionRecord,
    SubmitRequest,
    SubmitResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["forms"])

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

    fieldType is returned alongside the name because required-ness is checked
    differently for upload fields (data holds a list of file-metadata dicts,
    not a string — see `_is_missing_required_value`).
    """
    required: dict[str, str] = {}

    def walk(stmts: list, inside_conditional: bool = False) -> None:
        for stmt in stmts:
            if not isinstance(stmt, dict):
                continue
            node_type = stmt.get("type")

            if node_type == "Field" and not inside_conditional:
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


def _parse_client_info(user_agent_header: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Derive (browser, device) from a raw User-Agent header.
    Returns (None, None) if the header is absent or fails to parse — never raises,
    since this must never block a respondent's submission.
    """
    if not user_agent_header:
        return None, None
    try:
        ua = parse_user_agent(user_agent_header)
    except Exception:
        return None, None

    browser = ua.browser.family or None
    if browser and ua.browser.version_string:
        browser = f"{browser} {ua.browser.version_string}"

    if ua.is_bot:
        device = "bot"
    elif ua.is_tablet:
        device = "tablet"
    elif ua.is_mobile:
        device = "mobile"
    elif ua.is_pc:
        device = "desktop"
    else:
        device = "other"

    return browser, device


def _resolve_started_at(
    form_id: str,
    session_id: Optional[str],
    explicit: Optional[datetime],
    db: Session,
) -> Optional[datetime]:
    """
    Preference order: an explicit started_at sent by the client, then the
    first-seen timestamp recorded by GET /forms/{id} for this session
    (FormView), then None if neither is available.
    """
    if explicit is not None:
        return explicit
    if not session_id:
        return None
    view = (
        db.query(FormView)
        .filter(FormView.form_id == form_id, FormView.session_id == session_id)
        .first()
    )
    return view.started_at if view else None


# Exact respondent-facing message for the "single_per_email" restriction.
DUPLICATE_EMAIL_MESSAGE = "You have already submitted this form."


def _reject_if_duplicate(form: Form, session_id: Optional[str], data: dict, db: Session) -> None:
    """
    Enforce Form.duplicate_mode:
      - "multiple"            — no restriction ("None"); always passes.
      - "single_per_session"  — one submission per respondent session; a form
        with no session_id supplied can't be deduplicated this way (nothing
        to key on), so it's let through.
      - "single_per_email"    — one submission per email address, keyed off
        the form's first `email`-type field (found via `_collect_field_defs`,
        the same schema walker analytics uses — not a second implementation
        of "find the fields"). A form with no email field, or a submission
        that left it blank, can't be deduplicated this way either.
    Raises 409 on a duplicate; the exact detail message is what the public
    form page surfaces to the respondent.
    """
    mode = form.duplicate_mode

    if mode == DUPLICATE_MODE_SINGLE_PER_SESSION:
        if not session_id:
            return
        existing = (
            db.query(Submission)
            .filter(Submission.form_id == form.id, Submission.respondent_session_id == session_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A response has already been submitted for this session",
            )
        return

    if mode == DUPLICATE_MODE_SINGLE_PER_EMAIL:
        email_field_name = next(
            (f.get("name") for f in _collect_field_defs(form.compiled_schema) if f.get("fieldType") == "email"),
            None,
        )
        if not email_field_name:
            return
        submitted_email = str(data.get(email_field_name) or "").strip().lower()
        if not submitted_email:
            return
        prior_submissions = db.query(Submission).filter(Submission.form_id == form.id).all()
        for prior in prior_submissions:
            prior_email = str((prior.data or {}).get(email_field_name) or "").strip().lower()
            if prior_email == submitted_email:
                raise HTTPException(status_code=409, detail=DUPLICATE_EMAIL_MESSAGE)
        return


# ── Per-field analytics ──────────────────────────────────────────────────────

# Field types whose responses are tallied as a set of discrete options
# (single choice for select/radio, one true/false per option for checkbox).
CHOICE_FIELD_TYPES = {"select", "radio", "checkbox"}
NUMERIC_FIELD_TYPES = {"integer", "float"}
# Above this many distinct numeric values, a per-value distribution stops
# being useful (it's not a rating/small-range scale anymore) — min/max/avg
# alone are shown instead.
MAX_NUMERIC_DISTRIBUTION_VALUES = 15
# Cap on how many free-text sample responses ship per field (most recent
# distinct, non-empty values) — enough to get a feel without a huge payload.
MAX_TEXT_SAMPLES = 8


def _collect_field_defs(schema: Any) -> list[dict]:
    """
    Ordered list of every Field node in a compiled schema, walking statements
    + pages, and recursing into Section and BOTH branches of Conditional (so
    analytics reflects fields a respondent could have answered under either
    branch — unlike `_get_unconditional_required_fields`, which conservatively
    skips conditional fields for submission validation, this is read-only
    reporting so there's no downside to including them).

    RepeatGroup fields are intentionally skipped: their data keys are
    dynamic (`{name}_repeat_{i}`, one set per repeat instance per
    submission), which doesn't reduce to a single per-field breakdown the
    way every other field type does.
    """
    fields: list[dict] = []

    def walk(stmts: list) -> None:
        for stmt in stmts:
            if not isinstance(stmt, dict):
                continue
            node_type = stmt.get("type")
            if node_type == "Field":
                fields.append(stmt)
            elif node_type == "Section":
                walk(stmt.get("statements") or [])
            elif node_type == "Conditional":
                walk(stmt.get("then") or [])
                walk(stmt.get("else") or [])
            elif node_type == "Layout":
                walk(stmt.get("statements") or [])
            # RepeatGroup: intentionally not walked — see docstring.

    if not isinstance(schema, dict):
        return fields

    all_stmts: list = list(schema.get("statements") or [])
    for page in (schema.get("pages") or []):
        if isinstance(page, dict):
            all_stmts.extend(page.get("statements") or [])

    walk(all_stmts)
    return fields


def _parse_float(value: Any) -> Optional[float]:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _compute_field_analytics(schema: Any, submissions: list) -> list[FieldAnalytics]:
    """
    One FieldAnalytics entry per Field in the compiled schema (in document
    order), each populated with the breakdown appropriate to its fieldType.
    Fields that never appear in any submission still get an entry with
    answered_count=0, so the UI can render a proper empty state per field
    rather than silently omitting it.
    """
    field_defs = _collect_field_defs(schema)
    total = len(submissions)
    results: list[FieldAnalytics] = []

    for field in field_defs:
        name = str(field.get("name") or "")
        if not name:
            continue
        field_type = str(field.get("fieldType") or "text")
        ui = field.get("ui") or {}
        label = str(ui.get("label") or name) if isinstance(ui, dict) else name
        options = [str(o) for o in (field.get("options") or [])]

        entry = FieldAnalytics(
            name=name, label=label, field_type=field_type,
            answered_count=0, skipped_count=total,
        )

        if field_type == "checkbox":
            # Stored as one key per option: data["{name}__{option}"] = "true"/"false".
            tally: dict[str, int] = {opt: 0 for opt in options}
            answered_submissions = 0
            for s in submissions:
                data = s.data or {}
                any_checked = False
                for opt in options:
                    val = data.get(f"{name}__{opt}")
                    if val is True or (isinstance(val, str) and val.lower() == "true"):
                        tally[opt] = tally.get(opt, 0) + 1
                        any_checked = True
                if any_checked:
                    answered_submissions += 1
            entry.answered_count = answered_submissions
            entry.skipped_count = total - answered_submissions
            entry.option_counts = [FieldValueCount(value=opt, count=tally.get(opt, 0)) for opt in options]

        elif field_type in ("select", "radio"):
            tally = {}
            answered = 0
            for s in submissions:
                val = (s.data or {}).get(name)
                if val is None or str(val).strip() == "":
                    continue
                answered += 1
                key = str(val)
                tally[key] = tally.get(key, 0) + 1
            entry.answered_count = answered
            entry.skipped_count = total - answered
            # Every declared option, including ones nobody picked (0 count) —
            # a distribution that silently drops unpicked options is
            # misleading, same reasoning as checkbox above — then any stray
            # values a form update might have orphaned (still real data).
            ordered_keys = options + [k for k in tally if k not in options]
            entry.option_counts = [FieldValueCount(value=k, count=tally.get(k, 0)) for k in ordered_keys]

        elif field_type in NUMERIC_FIELD_TYPES:
            numbers: list[float] = []
            distinct: dict[str, int] = {}
            for s in submissions:
                num = _parse_float((s.data or {}).get(name))
                if num is None:
                    continue
                numbers.append(num)
                key = str(int(num)) if num.is_integer() else str(num)
                distinct[key] = distinct.get(key, 0) + 1
            entry.answered_count = len(numbers)
            entry.skipped_count = total - len(numbers)
            if numbers:
                entry.numeric_min = min(numbers)
                entry.numeric_max = max(numbers)
                entry.numeric_avg = sum(numbers) / len(numbers)
                if len(distinct) <= MAX_NUMERIC_DISTRIBUTION_VALUES:
                    sorted_keys = sorted(distinct.keys(), key=lambda k: float(k))
                    entry.numeric_distribution = [FieldValueCount(value=k, count=distinct[k]) for k in sorted_keys]

        elif field_type == "date":
            dates: list[str] = []
            for s in submissions:
                val = (s.data or {}).get(name)
                if val and isinstance(val, str) and val.strip():
                    dates.append(val.strip())
            entry.answered_count = len(dates)
            entry.skipped_count = total - len(dates)
            if dates:
                entry.date_min = min(dates)
                entry.date_max = max(dates)

        else:
            # text, email, url, boolean, upload, or anything else — treat as
            # freeform: just answered/skipped + a handful of recent samples.
            samples: list[str] = []
            answered = 0
            for s in reversed(submissions):  # most recent first (caller passes chronological order)
                val = (s.data or {}).get(name)
                if val is None:
                    continue
                if isinstance(val, list):  # upload fields: list of file-meta dicts
                    if len(val) == 0:
                        continue
                    answered += 1
                    text = ", ".join(str(v.get("name", "")) for v in val if isinstance(v, dict))
                else:
                    text = str(val).strip()
                    if not text:
                        continue
                    answered += 1
                if len(samples) < MAX_TEXT_SAMPLES and text not in samples:
                    samples.append(text[:200])
            entry.answered_count = answered
            entry.skipped_count = total - answered
            entry.text_samples = samples

        results.append(entry)

    return results


def _flatten_cell_value(value: Any) -> str:
    """Render a single `data[fieldName]` value as a CSV/XLSX cell string."""
    if value is None:
        return ""
    if isinstance(value, list):
        if all(isinstance(v, dict) for v in value):
            # Upload-field shape: list of {name, size, mimeType, url}.
            return "; ".join(str(v.get("name") or v.get("url") or "") for v in value)
        return json.dumps(value)
    if isinstance(value, dict):
        return json.dumps(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _build_export_columns(submissions: list[Submission]) -> list[str]:
    """Union of every `data` key across submissions, in first-seen order."""
    columns: list[str] = []
    seen: set[str] = set()
    for s in submissions:
        for key in (s.data or {}).keys():
            if key not in seen:
                seen.add(key)
                columns.append(key)
    return columns


EXPORT_METADATA_HEADERS = ["submission_id", "session_id", "browser", "device", "started_at", "submitted_at"]


def _export_row(submission: Submission, field_columns: list[str]) -> list[str]:
    metadata = [
        submission.id,
        submission.respondent_session_id or "",
        submission.browser or "",
        submission.device or "",
        submission.started_at.isoformat() if submission.started_at else "",
        submission.submitted_at.isoformat() if submission.submitted_at else "",
    ]
    fields = [_flatten_cell_value((submission.data or {}).get(col)) for col in field_columns]
    return metadata + fields


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


def _persist_submission(
    form: Form,
    data: dict,
    session_id: Optional[str],
    background_tasks: BackgroundTasks,
    db: Session,
    user_agent: Optional[str] = None,
    browser: Optional[str] = None,
    device: Optional[str] = None,
    started_at: Optional[datetime] = None,
) -> SubmitResponse:
    """
    Shared tail end of both submit endpoints (JSON and multipart): insert the
    Submission row, fire the optional webhook, and build the response.
    """
    submission = Submission(
        form_id=form.id,
        respondent_session_id=session_id,
        data=data,
        user_agent=user_agent,
        browser=browser,
        device=device,
        started_at=started_at,
    )
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

    is_new_session = not session
    session_id = session if session else str(uuid.uuid4())

    if is_new_session:
        # Record the moment this respondent first opened the form, so
        # Submission.started_at can be derived later without any frontend
        # changes. Refreshing the page with the SAME ?session= does not
        # reset this — only a brand-new session mints a new view row.
        db.add(FormView(form_id=form.id, session_id=session_id))
        db.commit()

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
    request: Request,
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

    _reject_if_duplicate(form, body.session_id, body.data, db)

    # ── Required-field validation ──────────────────────────────────────────────
    if form.compiled_schema:
        missing = _find_missing_required(form.compiled_schema, body.data)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required fields: {', '.join(missing)}",
            )

    user_agent = request.headers.get("user-agent")
    browser, device = _parse_client_info(user_agent)
    started_at = _resolve_started_at(form.id, body.session_id, body.started_at, db)

    return _persist_submission(
        form, body.data, body.session_id, background_tasks, db,
        user_agent=user_agent, browser=browser, device=device, started_at=started_at,
    )


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

    _reject_if_duplicate(form, session_id, data, db)

    # Optional client-supplied ISO-8601 timestamp, same semantics as
    # SubmitRequest.started_at on the JSON endpoint above.
    started_at_raw = form_data.get("started_at")
    explicit_started_at: Optional[datetime] = None
    if isinstance(started_at_raw, str) and started_at_raw:
        try:
            explicit_started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
        except ValueError:
            pass  # ignore malformed value; fall back to FormView lookup

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

    user_agent = request.headers.get("user-agent")
    browser, device = _parse_client_info(user_agent)
    started_at = _resolve_started_at(form.id, session_id, explicit_started_at, db)

    return _persist_submission(
        form, data, session_id, background_tasks, db,
        user_agent=user_agent, browser=browser, device=device, started_at=started_at,
    )


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
    if body.duplicate_mode is not None:
        form.duplicate_mode = body.duplicate_mode
    db.commit()
    return {"ok": True}


@router.post("/forms/{form_id}/publish", response_model=PublishResponse)
def publish_form(
    form_id: str,
    body: PublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark a form as published and store the final compiled schema.

    The frontend runs the WASM compiler one last time and sends the resulting
    JSON AST here — we do NOT recompile FormL server-side.
    Returns the public URL and iframe embed snippet.
    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)

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


@router.post("/forms/{form_id}/unpublish", status_code=200)
def unpublish_form(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Take a form offline: GET /forms/{id} and the submit endpoints will 404 it
    for respondents again. The stored compiled_schema and every existing
    submission are left untouched — re-publishing just flips is_published
    back on, it doesn't lose anything.
    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)
    form.is_published = False
    db.commit()
    return {"ok": True, "is_published": False}


@router.get("/forms/{form_id}/responses", response_model=PaginatedSubmissions)
def list_responses(
    form_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    sort: str = Query(default="desc", pattern="^(asc|desc)$", description="Sort by submitted_at"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List submissions for a form (author-only view), paginated.
    Auth-guarded: the requesting user must own the form's parent project.

    Returns {items, total, limit, offset} rather than a bare array, so callers
    can page through large response sets and still know the total count.
    """
    form = get_form_or_403(form_id, current_user, db)

    query = db.query(Submission).filter(Submission.form_id == form.id)
    total = query.count()
    order = Submission.submitted_at.asc() if sort == "asc" else Submission.submitted_at.desc()
    items = query.order_by(order).offset(offset).limit(limit).all()

    return PaginatedSubmissions(items=items, total=total, limit=limit, offset=offset)


@router.post("/forms/{form_id}/duplicate", response_model=FormCreateResponse, status_code=201)
def duplicate_form(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a copy of a form within the same project: same forml_source,
    compiled_schema, and duplicate_mode; always unpublished; title suffixed
    with " (copy)". Submissions and the sequential link (next_form_id) are
    deliberately NOT copied — a duplicate starts as a fresh, unlinked draft.
    Auth-guarded: the requesting user must own the form's parent project.
    """
    source = get_form_or_403(form_id, current_user, db)

    copy = Form(
        project_id=source.project_id,
        title=f"{source.title} (copy)",
        forml_source=source.forml_source,
        compiled_schema=source.compiled_schema,
        duplicate_mode=source.duplicate_mode,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy


@router.get("/forms/{form_id}/responses/export")
def export_responses(
    form_id: str,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export every submission for a form as CSV or XLSX.

    Columns: fixed metadata (submission_id, session_id, browser, device,
    started_at, submitted_at) followed by the union of every field name that
    appears across all submissions' `data`, in first-seen order. Upload-field
    values (lists of {name, size, mimeType, url}) are flattened to a
    semicolon-joined list of filenames.

    Registered ABOVE GET /forms/{form_id}/responses/{submission_id} so the
    literal "export" path segment is matched before the {submission_id}
    path parameter would otherwise swallow it.

    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)

    submissions = (
        db.query(Submission)
        .filter(Submission.form_id == form.id)
        .order_by(Submission.submitted_at.asc())
        .all()
    )

    field_columns = _build_export_columns(submissions)
    headers = EXPORT_METADATA_HEADERS + field_columns

    safe_title = re.sub(r"[^A-Za-z0-9_-]+", "_", form.title).strip("_") or form.id
    filename = f"{safe_title}_responses.{format}"

    if format == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "Responses"
        ws.append(headers)
        for submission in submissions:
            ws.append(_export_row(submission, field_columns))
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for submission in submissions:
        writer.writerow(_export_row(submission, field_columns))
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/forms/{form_id}/analytics", response_model=FormAnalytics)
def get_form_analytics(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate analytics for a form (author-only): submission volume by day
    (+ today/7-day/30-day rollups), device/browser breakdowns, average
    completion time (submitted_at - started_at, over submissions where
    started_at is known), and a per-field response breakdown.

    Auth-guarded: the requesting user must own the form's parent project.
    """
    form = get_form_or_403(form_id, current_user, db)

    submissions = (
        db.query(Submission)
        .filter(Submission.form_id == form.id)
        .order_by(Submission.submitted_at.asc())
        .all()
    )

    by_day: dict[str, int] = {}
    device_breakdown: dict[str, int] = {}
    browser_breakdown: dict[str, int] = {}
    completion_seconds: list[float] = []

    for s in submissions:
        day = s.submitted_at.date().isoformat()
        by_day[day] = by_day.get(day, 0) + 1

        device_key = s.device or "unknown"
        device_breakdown[device_key] = device_breakdown.get(device_key, 0) + 1

        browser_key = s.browser or "unknown"
        browser_breakdown[browser_key] = browser_breakdown.get(browser_key, 0) + 1

        if s.started_at is not None:
            delta = (s.submitted_at - s.started_at).total_seconds()
            if delta >= 0:
                completion_seconds.append(delta)

    submissions_by_day = [
        AnalyticsDayCount(date=day, count=count) for day, count in sorted(by_day.items())
    ]
    avg_completion = (
        sum(completion_seconds) / len(completion_seconds) if completion_seconds else None
    )

    # Computed via SQL (not by comparing to the already-fetched `submissions`
    # in Python) because SQLite hands back naive datetimes for submitted_at —
    # comparing those to a tz-aware `datetime.now(timezone.utc)` boundary
    # raises TypeError. Filtering in the query lets SQLAlchemy/SQLite compare
    # consistently the same way dashboard.py's rollups already do.
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    since_7d = now - timedelta(days=7)
    since_30d = now - timedelta(days=30)
    today_responses = (
        db.query(func.count(Submission.id))
        .filter(Submission.form_id == form.id, Submission.submitted_at >= today_start)
        .scalar()
    ) or 0
    responses_7d = (
        db.query(func.count(Submission.id))
        .filter(Submission.form_id == form.id, Submission.submitted_at >= since_7d)
        .scalar()
    ) or 0
    responses_30d = (
        db.query(func.count(Submission.id))
        .filter(Submission.form_id == form.id, Submission.submitted_at >= since_30d)
        .scalar()
    ) or 0

    return FormAnalytics(
        form_id=form.id,
        total_submissions=len(submissions),
        today_responses=today_responses,
        responses_last_7_days=responses_7d,
        responses_last_30_days=responses_30d,
        submissions_by_day=submissions_by_day,
        device_breakdown=device_breakdown,
        browser_breakdown=browser_breakdown,
        avg_completion_seconds=avg_completion,
        completion_sample_size=len(completion_seconds),
        fields=_compute_field_analytics(form.compiled_schema, submissions),
    )


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


@router.delete("/forms/{form_id}/responses/{submission_id}", status_code=200)
def delete_response(
    form_id: str,
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a single submission — backs the response-management table's
    per-row delete action (as opposed to DELETE /forms/{id}/responses below,
    which clears every submission at once for the "Rename & Delete" flow).
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

    db.delete(submission)
    db.commit()
    return {"ok": True}


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
