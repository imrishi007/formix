"""
backend/models.py
SQLAlchemy ORM models for Formix.

Tables:
  - users       : author accounts (email + hashed password)
  - projects    : Overleaf-style containers; each project belongs to one user
  - forms       : form definitions; each form belongs to one project
  - submissions : respondent answer payloads; optionally linked by session token
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


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
    """

    __tablename__ = "submissions"

    id                    = Column(String, primary_key=True, default=_uuid)
    form_id               = Column(String, ForeignKey("forms.id"), nullable=False, index=True)
    respondent_session_id = Column(String, nullable=True, index=True)
    data                  = Column(JSON,   nullable=False)
    submitted_at          = Column(DateTime(timezone=True), default=_now, nullable=False)

    form = relationship("Form", back_populates="submissions", foreign_keys=[form_id])
