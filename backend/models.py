"""
backend/models.py
SQLAlchemy ORM models for Formix.

Tables:
  - users       : author accounts (email + hashed password)
  - projects    : Overleaf-style containers; each project belongs to one user
  - forms       : form definitions; each form belongs to one project
  - submissions : respondent answer payloads; optionally linked by session token
  - form_views  : first-seen timestamp per (form, respondent session); used to
                  derive Submission.started_at without any frontend changes
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


# Allowed values for Form.duplicate_mode.
DUPLICATE_MODE_MULTIPLE = "multiple"            # unlimited submissions per respondent session ("None" restriction — default)
DUPLICATE_MODE_SINGLE_PER_SESSION = "single_per_session"  # one submission per respondent session; further attempts are rejected (409)
DUPLICATE_MODE_SINGLE_PER_EMAIL = "single_per_email"      # one submission per email value ("One response per email"); further attempts are rejected (409)
DUPLICATE_MODES = (DUPLICATE_MODE_MULTIPLE, DUPLICATE_MODE_SINGLE_PER_SESSION, DUPLICATE_MODE_SINGLE_PER_EMAIL)


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    """
    An author account.  Respondents fill forms anonymously and never have an account.
    """

    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=_uuid)
    email           = Column(String, unique=True, nullable=False, index=True)
    name            = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


# ── Projects ──────────────────────────────────────────────────────────────────

class Project(Base):
    """
    A named container that groups related forms together (like an Overleaf project).
    Owned by one User.
    """

    __tablename__ = "projects"

    id         = Column(String, primary_key=True, default=_uuid)
    owner_id   = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title      = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    owner = relationship("User", back_populates="projects")
    forms = relationship("Form", back_populates="project", cascade="all, delete-orphan")


# ── Forms ─────────────────────────────────────────────────────────────────────

class Form(Base):
    """
    A form definition created by an author.

    - project_id    : which project this form belongs to (required)
    - forml_source  : the raw FormL text the author wrote
    - compiled_schema : the JSON AST from the WASM compiler; rendered by the
                        public respondent page
    - is_published  : only published forms are publicly accessible
    - next_form_id  : optional FK to another Form in the same project; enables
                      sequential multi-form flows
    """

    __tablename__ = "forms"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title           = Column(String, nullable=False)
    forml_source    = Column(Text,   nullable=False)
    compiled_schema = Column(JSON,   nullable=True)   # null until first compile/publish
    is_published    = Column(Boolean, default=False,  nullable=False)
    next_form_id    = Column(String, ForeignKey("forms.id"), nullable=True)
    # How repeat submissions from the same respondent session are handled —
    # see DUPLICATE_MODES above. Enforced in routers/forms.py at submit time.
    duplicate_mode  = Column(String, default=DUPLICATE_MODE_MULTIPLE, nullable=False)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    project     = relationship("Project", back_populates="forms")
    submissions = relationship("Submission", back_populates="form",
                               cascade="all, delete-orphan",
                               foreign_keys="Submission.form_id")
    next_form   = relationship("Form", remote_side="Form.id", foreign_keys=[next_form_id])


# ── Submissions ───────────────────────────────────────────────────────────────

class Submission(Base):
    """
    A single respondent's answer payload for a published form.

    - respondent_session_id : anonymous UUID generated at GET /forms/{id}.
                              Links submissions across a multi-form flow.
                              Not tied to any user account.
    - data                  : {fieldName: value} dict collected from the browser.
    - user_agent            : raw User-Agent header captured at submit time (kept
                              alongside the parsed browser/device so those can be
                              re-derived later if the parsing library improves).
    - browser / device      : parsed from user_agent via the `user_agents` library
                              (e.g. browser="Chrome 124.0", device="mobile"/"tablet"/"desktop").
                              Null when the header was absent or unparsable.
    - started_at            : when the respondent first loaded this form in this
                              session, taken from FormView.started_at (see below);
                              falls back to whatever the client explicitly sends,
                              and is left null if neither is available.
    """

    __tablename__ = "submissions"

    id                    = Column(String, primary_key=True, default=_uuid)
    form_id               = Column(String, ForeignKey("forms.id"), nullable=False, index=True)
    respondent_session_id = Column(String, nullable=True, index=True)
    data                  = Column(JSON,   nullable=False)
    user_agent            = Column(Text,   nullable=True)
    browser               = Column(String, nullable=True)
    device                = Column(String, nullable=True)
    started_at            = Column(DateTime(timezone=True), nullable=True)
    submitted_at          = Column(DateTime(timezone=True), default=_now, nullable=False)

    form = relationship("Form", back_populates="submissions", foreign_keys=[form_id])


# ── Form views (used to derive Submission.started_at) ──────────────────────────

class FormView(Base):
    """
    First-seen timestamp for a (form, respondent session) pair, recorded the
    moment a NEW session_id is minted by GET /forms/{id} (i.e. the respondent's
    first load of the form, not subsequent page refreshes with an existing
    ?session= param). Looked up at submit time to populate Submission.started_at
    without requiring any frontend changes.
    """

    __tablename__ = "form_views"
    __table_args__ = (UniqueConstraint("form_id", "session_id", name="uq_form_views_form_session"),)

    id         = Column(String, primary_key=True, default=_uuid)
    form_id    = Column(String, ForeignKey("forms.id"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), default=_now, nullable=False)
