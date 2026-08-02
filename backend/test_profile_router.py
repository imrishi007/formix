"""
backend/test_profile_router.py
Self-contained pytest suite for the profile router and the dashboard
activity endpoint (backend/routers/profile.py, dashboard.py).

Same harness as test_ai_router.py: in-memory SQLite, auth bypassed, no server.
Run from the repo root:
    python -m pytest backend/test_profile_router.py -q
"""

import sys
from pathlib import Path

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import models  # noqa: E402  (registers all models on Base.metadata)
from backend.auth import get_current_user  # noqa: E402
from backend.database import Base, get_db  # noqa: E402
from backend.main import app  # noqa: E402


_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
Base.metadata.create_all(_engine)


# The profile PATCH route MUTATES current_user and commits, so the auth
# override must hand back a persistent User bound to the SAME session the
# route uses (FastAPI caches dependency results within a request, so both the
# get_current_user override and the route share one get_db session).
def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _current_user_override(db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.id == "user_a").first()


@pytest.fixture(autouse=True)
def _reset_overrides():
    """Reset the DB and overrides between tests; default current user to A."""
    app.dependency_overrides.clear()
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    db = _TestingSessionLocal()
    user_a = models.User(id="user_a", email="a@test.com", name="Alice", hashed_password="x")
    project = models.Project(id="proj_1", owner_id="user_a", title="A's project")
    form_pub = models.Form(
        id="form_1", project_id="proj_1", title="Contact",
        forml_source="form Contact {}", is_published=True,
    )
    form_draft = models.Form(
        id="form_2", project_id="proj_1", title="Feedback",
        forml_source="form Feedback {}", is_published=False,
    )
    submission = models.Submission(
        id="sub_1", form_id="form_1", data={"name": "x"},
    )
    db.add_all([user_a, project, form_pub, form_draft, submission])
    db.commit()
    db.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _current_user_override
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client():
    return TestClient(app)


# ── GET /profile ─────────────────────────────────────────────────────────────

def test_profile_returns_account_info_and_totals(client):
    resp = client.get("/profile")
    assert resp.status_code == 200
    data = resp.json()

    assert data["user"]["email"] == "a@test.com"
    assert data["user"]["name"] == "Alice"
    assert data["user"]["avatar_url"] is None
    assert data["total_forms"] == 2
    assert data["published_forms"] == 1
    assert data["total_submissions"] == 1

    # The heatmap series covers exactly one year, including today.
    assert len(data["forms_by_day"]) == 365
    assert all(isinstance(b["count"], int) for b in data["forms_by_day"])
    assert sum(b["count"] for b in data["forms_by_day"]) == 2  # both forms land today


def test_profile_requires_auth(client):
    app.dependency_overrides[get_current_user] = lambda: (_ for _ in ()).throw(
        __import__("fastapi").HTTPException(status_code=401)
    )
    resp = client.get("/profile")
    assert resp.status_code == 401


# ── PATCH /profile ───────────────────────────────────────────────────────────

def test_profile_update_sets_name_and_avatar(client):
    resp = client.patch("/profile", json={"name": "Alicia", "avatar_url": "data:image/png;base64,AAAA"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Alicia"
    assert data["avatar_url"] == "data:image/png;base64,AAAA"


def test_profile_update_partial_keeps_other_fields(client):
    # Name only — avatar untouched.
    resp = client.patch("/profile", json={"name": "Bob"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Bob"
    assert resp.json()["avatar_url"] is None


def test_profile_update_rejects_oversized_avatar(client):
    huge = "data:image/png;base64," + ("A" * 2_100_000)
    resp = client.patch("/profile", json={"avatar_url": huge})
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is None  # silently dropped, not stored


# ── GET /dashboard/activity ──────────────────────────────────────────────────

def test_dashboard_activity_returns_chart_series(client):
    resp = client.get("/dashboard/activity")
    assert resp.status_code == 200
    data = resp.json()

    assert len(data["forms_by_day"]) == 30
    assert len(data["submissions_by_day"]) == 30
    assert sum(b["count"] for b in data["forms_by_day"]) == 2
    assert sum(b["count"] for b in data["submissions_by_day"]) == 1

    # Top forms ranked by responses — only forms that have received responses
    # appear (Feedback has zero, so it's excluded).
    top = data["top_forms"]
    assert [t["title"] for t in top] == ["Contact"]
    assert top[0]["submission_count"] == 1
