"""
backend/test_oauth.py
Self-contained pytest suite for the OAuth login feature
(backend/routers/oauth.py and the GET /auth/me endpoint).

Same harness as test_profile_router.py: in-memory SQLite, auth bypassed, no
server. The provider round-trips themselves (redirect to Google/GitHub and the
code exchange) can't run without real provider credentials, so the suite tests
everything that doesn't need them:

  - find-or-create account logic (the security-critical part)
  - /auth/me
  - the authorize/callback endpoints' failure behavior when a provider is not
    configured (503 / 404 / error-redirect)

Run from the repo root:
    python -m pytest backend/test_oauth.py -q
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

from backend import models  # noqa: E402
from backend.auth import create_access_token, get_current_user  # noqa: E402
from backend.database import Base, get_db  # noqa: E402
from backend.main import app  # noqa: E402
from backend.routers.oauth import _find_or_create_oauth_user  # noqa: E402


_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
Base.metadata.create_all(_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _current_user_override(db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.id == "user_a").first()


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Strip provider credentials from the environment so the endpoints behave
    as "unconfigured" regardless of what's in backend/.env on the dev machine."""
    for key in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"):
        monkeypatch.delenv(key, raising=False)
    # The oauth module caches its provider registry in `_oauth` — reset it so
    # the "unconfigured" assertions hold even after env changes.
    monkeypatch.setattr("backend.routers.oauth._oauth", None)


@pytest.fixture(autouse=True)
def _reset_overrides():
    """Reset the DB and overrides between tests."""
    app.dependency_overrides.clear()
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    db = _TestingSessionLocal()
    user_a = models.User(id="user_a", email="a@test.com", name="Alice", hashed_password="hashed")
    db.add(user_a)
    db.commit()
    db.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _current_user_override
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client():
    return TestClient(app)


# ── find-or-create account logic ─────────────────────────────────────────────

def test_creates_new_oauth_user():
    db = _TestingSessionLocal()
    user = _find_or_create_oauth_user(
        db,
        "google",
        {"subject": "g-123", "email": "new@test.com", "name": "New User", "avatar_url": "https://pic"},
    )
    assert user.email == "new@test.com"
    assert user.name == "New User"
    assert user.avatar_url == "https://pic"
    assert user.oauth_provider == "google"
    assert user.oauth_subject == "g-123"
    assert user.hashed_password is None  # OAuth accounts have no password
    db.close()


def test_find_or_create_is_idempotent_for_same_identity():
    db = _TestingSessionLocal()
    profile = {"subject": "g-1", "email": "same@test.com", "name": "Same"}
    first = _find_or_create_oauth_user(db, "google", profile)
    second = _find_or_create_oauth_user(db, "google", profile)
    assert first.id == second.id
    assert db.query(models.User).count() == 2  # only the fixture user + this one
    db.close()


def test_links_oauth_identity_to_existing_email_account():
    db = _TestingSessionLocal()
    user = _find_or_create_oauth_user(db, "github", {"subject": "gh-1", "email": "a@test.com", "name": "Alice"})
    assert user.id == "user_a"  # the existing password account, not a duplicate
    assert user.oauth_provider == "github"
    assert user.oauth_subject == "gh-1"
    assert user.hashed_password == "hashed"  # password login still works
    assert db.query(models.User).count() == 1
    db.close()


def test_links_existing_email_account_case_insensitively():
    """Regression: the users.email column is unique, so a case-sensitive lookup
    used to MISS the existing account and then violate the constraint on insert
    (the 500 for "sign in with Google when the email is already registered")."""
    db = _TestingSessionLocal()
    user = _find_or_create_oauth_user(db, "google", {"subject": "g-1", "email": "A@Test.COM", "name": "Alice"})
    assert user.id == "user_a"
    assert user.oauth_provider == "google"
    assert user.oauth_subject == "g-1"
    assert db.query(models.User).count() == 1  # no duplicate row created
    db.close()


def test_login_links_and_syncs_avatar_from_provider():
    """Every OAuth login refreshes the profile picture from the provider (the
    'use my Gmail photo' behavior) without disturbing the account."""
    db = _TestingSessionLocal()
    profile = {"subject": "g-1", "email": "a@test.com", "name": "Alice", "avatar_url": "https://pic/v2"}
    user = _find_or_create_oauth_user(db, "google", profile)
    assert user.avatar_url == "https://pic/v2"
    assert user.name == "Alice"
    db.close()


def test_does_not_overwrite_identity_of_other_provider():
    db = _TestingSessionLocal()
    db.add(models.User(id="user_b", email="b@test.com", name="Bea", hashed_password="x",
                       oauth_provider="google", oauth_subject="g-b"))
    db.commit()
    user = _find_or_create_oauth_user(db, "github", {"subject": "gh-b", "email": "b@test.com", "name": "Bea"})
    assert user.id == "user_b"
    assert user.oauth_provider == "google"  # not overwritten
    assert user.oauth_subject == "g-b"
    db.close()


def test_falls_back_to_synthetic_email_when_provider_withholds_it():
    db = _TestingSessionLocal()
    user = _find_or_create_oauth_user(db, "github", {"subject": "no-email", "email": None, "name": None})
    assert user.email == "github+no-email@oauth.local"
    db.close()


# ── GET /auth/me ─────────────────────────────────────────────────────────────

def test_me_returns_current_user(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "a@test.com"


def test_me_with_real_token(client):
    # Exercise the REAL token validation path (no override) for good measure.
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = _override_get_db
    token = create_access_token({"sub": "user_a"})
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "a@test.com"


# ── OAuth endpoint failure modes (no provider configured in CI) ──────────────

def test_authorize_unknown_provider_is_404(client):
    resp = client.get("/auth/oauth/discord", follow_redirects=False)
    assert resp.status_code == 404


def test_authorize_unconfigured_provider_is_503(client):
    resp = client.get("/auth/oauth/google", follow_redirects=False)
    assert resp.status_code == 503
    assert "GOOGLE_CLIENT_ID" in resp.text


def test_callback_unconfigured_provider_redirects_with_error(client):
    resp = client.get("/auth/oauth/google/callback", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert resp.headers["location"].startswith("http://localhost:3000/auth/oauth/callback?error=")
