"""
backend/schemas.py
Pydantic request/response models for the Formix API.
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


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


class FormUpdate(BaseModel):
    forml_source: str
    compiled_schema: Optional[Any] = None


class FormLinkRequest(BaseModel):
    next_form_id: Optional[str] = None   # None = unlink


class FormCreateResponse(BaseModel):
    id: str
    title: str
    is_published: bool
    created_at: datetime

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
    submitted_at: datetime

    class Config:
        from_attributes = True
