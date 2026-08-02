"""
backend/test_auth_reset.py
Self-contained pytest suite for the password-reset flow
(POST /auth/forgot-password, POST /auth/reset-password).

Same harness as the other backend suites: in-memory SQLite, auth bypassed, no
server. SMTP is stripped from the environment so the endpoints always run in
dev mode (reset link returned in the response, nothing emailed).

Run from the repo root:
    python -m pytest backend/test_auth_reset.py -q
"""

import sys
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import models  # noqa: E402
from backend.auth import create_access_token, get_current_user  # noqa: E402
from backend.database import Base, get_db  # noqa: E402
from backend.main import app  # noqa: E402


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


def _current_user_override(db=Depends(get_db)):
    return db.query(models.User).filter(models.User.id == "user_a").first()


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Force dev mode (no SMTP) so forgot-password never tries to email."""
    for key in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture(autouse=True)
def _reset_db():
    app.dependency_overrides.clear()
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    db = _TestingSessionLocal()
    db.add(models.User(id="user_a", email="a@test.com", name="Alice", hashed_password="old-hash"))
    # An OAuth-only account (no password) — must never receive a reset link.
    db.add(models.User(id="user_oauth", email="oauth@test.com", name="Ollie",
                       hashed_password=None, oauth_provider="google", oauth_subject="g-1"))
    db.commit()
    db.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _current_user_override
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client():
    return TestClient(app)


def _reset_token() -> str:
    return create_access_token({"sub": "user_a", "typ": "password_reset"}, expires_delta=timedelta(hours=1))


# ── forgot-password ──────────────────────────────────────────────────────────

def test_forgot_password_returns_dev_link_for_existing_account(client):
    resp = client.post("/auth/forgot-password", json={"email": "a@test.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert "reset link is on its way" in data["message"]
    assert data["reset_link"].startswith("http://localhost:3000/auth/reset-password?token=")


def test_forgot_password_does_not_enumerate_accounts(client):
    # Unknown email: identical message, no link — same shape as a real account.
    resp = client.post("/auth/forgot-password", json={"email": "nobody@test.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert "reset link is on its way" in data["message"]
    assert data["reset_link"] is None


def test_forgot_password_hides_dev_link_on_render(client, monkeypatch):
    # Simulates the dangerous deploy: on Render with SMTP unset, the dev-mode
    # fallback link must NOT ride in the API response — that would let anyone
    # who knows an email take over the account.
    monkeypatch.setenv("RENDER", "true")
    resp = client.post("/auth/forgot-password", json={"email": "a@test.com"})
    assert resp.status_code == 200
    assert resp.json()["reset_link"] is None


def test_forgot_password_skips_oauth_only_accounts(client):
    resp = client.post("/auth/forgot-password", json={"email": "oauth@test.com"})
    assert resp.status_code == 200
    assert resp.json()["reset_link"] is None


# ── reset-password ───────────────────────────────────────────────────────────

def test_reset_password_works_and_new_password_signs_in(client):
    resp = client.post("/auth/reset-password", json={"token": _reset_token(), "password": "brand-new-pw-123"})
    assert resp.status_code == 200

    login = client.post("/auth/login", json={"email": "a@test.com", "password": "brand-new-pw-123"})
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_reset_password_rejects_wrong_password(client):
    login = client.post("/auth/login", json={"email": "a@test.com", "password": "still-old"})
    assert login.status_code == 401


def test_reset_password_rejects_login_token(client):
    token = create_access_token({"sub": "user_a"})  # no "typ" claim — a normal session JWT
    resp = client.post("/auth/reset-password", json={"token": token, "password": "whatever-123"})
    assert resp.status_code == 400


def test_reset_password_rejects_garbage_token(client):
    resp = client.post("/auth/reset-password", json={"token": "not-a-jwt", "password": "whatever-123"})
    assert resp.status_code == 400


def test_reset_password_rejects_short_password(client):
    resp = client.post("/auth/reset-password", json={"token": _reset_token(), "password": "short"})
    assert resp.status_code == 422
