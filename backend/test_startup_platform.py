"""Small direct checks for startup-platform logic; no server or network."""

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import models  # noqa: E402
from backend.database import Base  # noqa: E402
from backend.database import _normalise_database_url  # noqa: E402
from backend.deps import get_form_or_403, get_project_or_403  # noqa: E402
from backend.routers import drafts, forms, releases, webhooks  # noqa: E402
from backend.schemas import DraftSaveRequest, PublishRequest, RollbackRequest, WebhookCreate  # noqa: E402


_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


@pytest.fixture()
def db():
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)
    session = _Session()
    owner = models.User(id="owner", email="owner@example.com", hashed_password="x")
    member = models.User(id="member", email="member@example.com", hashed_password="x")
    project = models.Project(id="project", owner_id="owner", title="Demo")
    form = models.Form(id="form", project_id="project", title="Contact", forml_source='form "Contact" {}')
    session.add_all([owner, member, project, form])
    session.commit()
    yield session
    session.close()


def _publish(db, environment: str, name: str):
    return forms.publish_form(
        "form",
        PublishRequest(
            compiled_schema={"type": "Form", "name": name, "statements": []},
            base_url="https://formix.example",
            environment=environment,
        ),
        db,
        db.get(models.User, "owner"),
    )


def test_database_url_uses_the_installed_postgres_driver():
    assert _normalise_database_url("postgres://user:pass@host/db") == (
        "postgresql+psycopg2://user:pass@host/db"
    )
    assert _normalise_database_url("postgresql://user:pass@host/db") == (
        "postgresql+psycopg2://user:pass@host/db"
    )
    assert _normalise_database_url("postgresql+psycopg://user:pass@host/db") == (
        "postgresql+psycopg2://user:pass@host/db"
    )
    assert _normalise_database_url("sqlite:///local.db") == "sqlite:///local.db"


def test_preview_does_not_replace_production_and_rollback_is_instant(db):
    production = _publish(db, "production", "Production")
    preview = _publish(db, "preview", "Preview")
    assert production.version == 1 and preview.version == 2

    public = forms.get_form("form", None, db)
    assert public.compiled_schema["name"] == "Production"
    assert public.version == 1

    token = preview.public_url.split("token=", 1)[1]
    assert releases.preview_form("form", token, None, db).compiled_schema["name"] == "Preview"

    releases.rollback_release(
        "form",
        RollbackRequest(
            release_id=preview.release_id,
            environment="production",
            base_url="https://formix.example",
        ),
        db,
        db.get(models.User, "owner"),
    )
    assert forms.get_form("form", None, db).compiled_schema["name"] == "Preview"


def test_saved_draft_round_trip(db):
    _publish(db, "production", "Production")
    saved = drafts.save_draft(
        "form", DraftSaveRequest(data={"name": "Rishi"}, current_page=2), db,
    )
    loaded = drafts.get_draft("form", saved.resume_token, db)
    assert loaded.data == {"name": "Rishi"}
    assert loaded.current_page == 2


def test_viewer_can_read_but_only_editor_can_change(db):
    db.add(models.ProjectMember(project_id="project", user_id="member", role="viewer"))
    db.commit()
    member = db.get(models.User, "member")
    assert get_project_or_403("project", member, db).id == "project"
    with pytest.raises(HTTPException) as denied:
        get_form_or_403("form", member, db, "editor")
    assert denied.value.status_code == 403

    db.query(models.ProjectMember).filter(models.ProjectMember.user_id == "member").update({"role": "editor"})
    db.commit()
    assert get_form_or_403("form", member, db, "editor").id == "form"


def test_webhook_secret_is_returned_once_and_private_targets_are_rejected(db):
    owner = db.get(models.User, "owner")
    with pytest.raises(HTTPException) as rejected:
        webhooks.create_webhook("form", WebhookCreate(url="http://127.0.0.1/internal"), db, owner)
    assert rejected.value.status_code == 422

    created = webhooks.create_webhook(
        "form", WebhookCreate(url="https://example.com/formix"), db, owner,
    )
    assert created.secret and len(created.secret) == 64
    assert webhooks.list_webhooks("form", db, owner)[0].secret is None
