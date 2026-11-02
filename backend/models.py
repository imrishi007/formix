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
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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

    Accounts are either email+password (hashed_password set, oauth_* NULL) or
    OAuth-created via Google/GitHub (oauth_provider/oauth_subject set,
    hashed_password NULL).  A user who originally signed up by email can later
    "link" an OAuth identity onto their account — that's how a single Google
    login keeps finding the same account.
    """

    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=_uuid)
    email           = Column(String, unique=True, nullable=False, index=True)
    name            = Column(String, nullable=True)
    # Author profile picture. Stored as a base64 data URL (data:image/png;base64,...)
    # so avatars work with zero static-file infrastructure on Render's free tier.
    # Null until the author uploads one; the frontend falls back to an initial.
    avatar_url      = Column(Text,   nullable=True)
    hashed_password = Column(String, nullable=True)
    # OAuth identity. Set only for accounts created or linked through
    # "Continue with Google / GitHub". (provider, subject) is globally unique,
    # which keeps find-or-create idempotent across logins.
    oauth_provider  = Column(String(32), nullable=True)
    oauth_subject   = Column(String(255), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth_provider_subject"),
    )

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")


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
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    """A project collaborator. The project owner is intentionally not duplicated here."""

    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),)

    id         = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String(16), nullable=False, default="viewer")  # editor | viewer
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


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
    # Draft source/schema stay on this row for backwards compatibility. Each
    # preview/production publish creates an immutable FormRelease and only the
    # active release ids below move, which makes rollback a constant-time update.
    preview_token                = Column(String(64), nullable=True, unique=True)
    active_preview_release_id    = Column(String, nullable=True, index=True)
    active_production_release_id = Column(String, nullable=True, index=True)
    release_counter              = Column(Integer, default=0, nullable=False)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    project     = relationship("Project", back_populates="forms")
    submissions = relationship("Submission", back_populates="form",
                               cascade="all, delete-orphan",
                               foreign_keys="Submission.form_id")
    ai_messages = relationship("AiChatMessage", back_populates="form",
                               cascade="all, delete-orphan")
    releases = relationship("FormRelease", back_populates="form", cascade="all, delete-orphan")
    drafts = relationship("FormDraft", back_populates="form", cascade="all, delete-orphan")
    webhooks = relationship("WebhookEndpoint", back_populates="form", cascade="all, delete-orphan")
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
    form_release_id       = Column(String, ForeignKey("form_releases.id"), nullable=True, index=True)
    respondent_session_id = Column(String, nullable=True, index=True)
    data                  = Column(JSON,   nullable=False)
    user_agent            = Column(Text,   nullable=True)
    browser               = Column(String, nullable=True)
    device                = Column(String, nullable=True)
    started_at            = Column(DateTime(timezone=True), nullable=True)
    submitted_at          = Column(DateTime(timezone=True), default=_now, nullable=False)

    form = relationship("Form", back_populates="submissions", foreign_keys=[form_id])


class FormRelease(Base):
    """Immutable compiler-verified snapshot promoted to preview or production."""

    __tablename__ = "form_releases"
    __table_args__ = (UniqueConstraint("form_id", "version", name="uq_form_releases_form_version"),)

    id              = Column(String, primary_key=True, default=_uuid)
    form_id         = Column(String, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    version         = Column(Integer, nullable=False)
    forml_source    = Column(Text, nullable=False)
    compiled_schema = Column(JSON, nullable=False)
    created_by_id   = Column(String, ForeignKey("users.id"), nullable=False)
    note            = Column(String(280), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)

    form = relationship("Form", back_populates="releases", foreign_keys=[form_id])


class FormDraft(Base):
    """Respondent progress stored behind a high-entropy resume token."""

    __tablename__ = "form_drafts"

    id           = Column(String, primary_key=True, default=_uuid)
    form_id      = Column(String, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    release_id   = Column(String, ForeignKey("form_releases.id"), nullable=True)
    resume_token = Column(String(96), unique=True, nullable=False, index=True)
    data         = Column(JSON, nullable=False, default=dict)
    current_page = Column(Integer, default=0, nullable=False)
    created_at   = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    expires_at   = Column(DateTime(timezone=True), nullable=False)

    form = relationship("Form", back_populates="drafts")


class WebhookEndpoint(Base):
    """Author-configured destination. Secrets are used only for HMAC signatures."""

    __tablename__ = "webhook_endpoints"

    id         = Column(String, primary_key=True, default=_uuid)
    form_id    = Column(String, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    url        = Column(Text, nullable=False)
    secret     = Column(String(128), nullable=False)
    enabled    = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    form = relationship("Form", back_populates="webhooks")
    deliveries = relationship("WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan")


class WebhookDelivery(Base):
    """Durable delivery record; failed requests can be inspected and replayed."""

    __tablename__ = "webhook_deliveries"

    id              = Column(String, primary_key=True, default=_uuid)
    webhook_id      = Column(String, ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False, index=True)
    submission_id   = Column(String, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    event            = Column(String(64), default="submission.created", nullable=False)
    payload          = Column(JSON, nullable=False)
    status           = Column(String(16), default="pending", nullable=False, index=True)
    attempt_count    = Column(Integer, default=0, nullable=False)
    response_status  = Column(Integer, nullable=True)
    last_error       = Column(Text, nullable=True)
    next_attempt_at  = Column(DateTime(timezone=True), nullable=True)
    delivered_at     = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), default=_now, nullable=False)

    webhook = relationship("WebhookEndpoint", back_populates="deliveries")


# ── AI chat history (per form, server-side) ────────────────────────────────────
# Persists the Formix AI conversation for a form so history survives reloads and
# follow-up turns ("make that field optional") resolve against prior turns. The
# client orchestrates the compile-and-repair loop and appends a completed turn
# (user message + assistant reply) once it resolves — see routers/ai.py.
# NOTE: a schema migration (alembic/versions/*) must stay in sync with this.

class AiChatMessage(Base):
    """
    One stored message in a form's AI conversation.

    - role           : "user" | "assistant"
    - content        : the message prose. For assistant messages this is the
                       explanation text (the diff view is what shows the user
                       what actually changed).
    - revised_source : assistant-only — the FULL revised .forml source the model
                       returned for that turn. Only stored for turns that
                       produced source (never a diff/partial patch), so a later
                       turn can be given the exact code the assistant stood on.
    """

    __tablename__ = "ai_chat_messages"

    id             = Column(String, primary_key=True, default=_uuid)
    form_id        = Column(String, ForeignKey("forms.id"), nullable=False, index=True)
    role           = Column(String, nullable=False)          # "user" | "assistant"
    content        = Column(Text,   nullable=False)
    revised_source = Column(Text,   nullable=True)
    created_at     = Column(DateTime(timezone=True), default=_now, nullable=False)

    form = relationship("Form", back_populates="ai_messages")


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
