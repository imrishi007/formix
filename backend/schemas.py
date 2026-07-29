"""
backend/schemas.py
Pydantic request/response models for the Formix API.
"""

from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel

# Mirrors backend.models.DUPLICATE_MODES — kept as a literal here (rather than
# importing) so schemas.py has no dependency on the ORM layer.
DuplicateMode = Literal["multiple", "single_per_session", "single_per_email"]


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    name: Optional[str] = None
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str


class ProjectResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FormSummary(BaseModel):
    """Lightweight form representation used inside project listings (no compiled_schema)."""
    id: str
    title: str
    is_published: bool
    next_form_id: Optional[str] = None
    duplicate_mode: DuplicateMode
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectDetail(BaseModel):
    """Full project info including form summaries."""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    forms: list[FormSummary]

    class Config:
        from_attributes = True


# ── Form create / update (within a project) ───────────────────────────────────

class FormCreateInProject(BaseModel):
    title: str
    forml_source: str
    compiled_schema: Optional[Any] = None
    # How repeat submissions from the same respondent session are handled.
    # Defaults to "multiple" (unlimited) when omitted, matching Form.duplicate_mode.
    duplicate_mode: Optional[DuplicateMode] = None


class FormUpdate(BaseModel):
    forml_source: str
    compiled_schema: Optional[Any] = None
    # Optional — set when the author accepts the workspace's "rename to match
    # the DSL's form title" suggestion. Omitted (or None) on every regular
    # autosave, which leaves the existing title untouched.
    title: Optional[str] = None
    # Optional — only changed when explicitly provided (same pattern as title).
    duplicate_mode: Optional[DuplicateMode] = None


class FormLinkRequest(BaseModel):
    next_form_id: Optional[str] = None   # None = unlink


class FormCreateResponse(BaseModel):
    id: str
    title: str
    is_published: bool
    duplicate_mode: DuplicateMode
    created_at: datetime

    class Config:
        from_attributes = True


class FormDetail(BaseModel):
    """Full author-view of a form, including forml_source — used to re-open
    an existing form for editing (as opposed to FormSummary, used in listings,
    or PublicFormResponse, used by the anonymous respondent route)."""
    id: str
    project_id: str
    title: str
    forml_source: str
    compiled_schema: Optional[Any] = None
    is_published: bool
    next_form_id: Optional[str] = None
    duplicate_mode: DuplicateMode
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Publish ───────────────────────────────────────────────────────────────────

class PublishRequest(BaseModel):
    compiled_schema: Any   # the full AST from the WASM compiler
    base_url: str          # window.location.origin from the author's browser


class PublishResponse(BaseModel):
    form_id: str
    public_url: str
    embed_snippet: str


# ── Public form (respondent view) ─────────────────────────────────────────────

class PublicFormResponse(BaseModel):
    id: str
    title: str
    compiled_schema: Any
    session_id: str   # minted here if not supplied via ?session= query param


# ── Submissions ───────────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    data: dict[str, Any]           # {fieldName: value} collected from the respondent
    session_id: Optional[str] = None
    # Optional explicit "respondent started filling this out at" timestamp, for
    # clients that track it themselves. If omitted, the server derives it from
    # FormView (first GET /forms/{id} for this session) when available.
    started_at: Optional[datetime] = None


class SubmitResponse(BaseModel):
    success: bool
    submission_id: str
    next_form_id: Optional[str] = None   # present only when Form.next_form_id is set
    session_id: Optional[str] = None     # echoed back so the respondent page can pass it forward


class SubmissionRecord(BaseModel):
    id: str
    form_id: str
    respondent_session_id: Optional[str] = None
    data: dict[str, Any]
    browser: Optional[str] = None
    device: Optional[str] = None
    started_at: Optional[datetime] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


class PaginatedSubmissions(BaseModel):
    """Response shape for GET /forms/{id}/responses with pagination."""
    items: list[SubmissionRecord]
    total: int
    limit: int
    offset: int


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_projects: int
    total_forms: int
    published_forms: int
    total_submissions: int
    today_responses: int
    submissions_last_7_days: int


class DashboardFormRow(BaseModel):
    """One row of GET /dashboard/forms — every form the user owns, across all
    of their projects, with the stats the dashboard's form table needs."""
    id: str
    title: str
    project_id: str
    project_title: str
    is_published: bool
    duplicate_mode: DuplicateMode
    created_at: datetime
    updated_at: datetime
    submission_count: int
    last_response_at: Optional[datetime] = None


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsDayCount(BaseModel):
    date: str    # ISO date, e.g. "2026-07-29"
    count: int


class FieldValueCount(BaseModel):
    """One bucket in a per-field breakdown — an option label (select/radio/
    checkbox) or a stringified numeric/date value, with how many responses
    had it."""
    value: str
    count: int


class FieldAnalytics(BaseModel):
    """
    Per-field response breakdown, shaped differently depending on field_type:
      - select / radio / checkbox → option_counts populated
      - integer / float           → numeric_* populated (+ distribution when
                                     few distinct values, which doubles as a
                                     rating-scale breakdown)
      - date                      → date_min / date_max populated
      - anything else (text, email, url, boolean, upload, ...) → text_samples
    A field only gets the bucket(s) relevant to its type; the rest are null.
    """
    name: str
    label: str
    field_type: str
    answered_count: int
    skipped_count: int
    option_counts: Optional[list[FieldValueCount]] = None
    numeric_min: Optional[float] = None
    numeric_max: Optional[float] = None
    numeric_avg: Optional[float] = None
    numeric_distribution: Optional[list[FieldValueCount]] = None
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    text_samples: Optional[list[str]] = None


class FormAnalytics(BaseModel):
    form_id: str
    total_submissions: int
    today_responses: int
    responses_last_7_days: int
    responses_last_30_days: int
    submissions_by_day: list[AnalyticsDayCount]
    device_breakdown: dict[str, int]
    browser_breakdown: dict[str, int]
    # Only computed over submissions that have both started_at and submitted_at.
    avg_completion_seconds: Optional[float] = None
    completion_sample_size: int
    fields: list[FieldAnalytics]
