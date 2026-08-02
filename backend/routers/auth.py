"""
backend/routers/auth.py
Authentication endpoints for the Formix API.

  POST /auth/register  — create a new author account, return JWT
  POST /auth/login     — verify credentials, return JWT
"""

import logging
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

log = logging.getLogger("formix.auth")

from ..auth import (
    create_access_token,
    decode_access_token,
    frontend_url,
    get_current_user,
    hash_password,
    verify_password,
)
from ..database import get_db
from ..emailer import send_reset_link
from ..models import User
from ..schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=Token, status_code=201)
def register(body: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new author account.
    Returns a JWT on success; 409 if the email is already registered.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return Token(access_token=token, user=UserResponse.model_validate(user))


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Verify email + password, return a JWT.
    Returns 401 on invalid credentials (intentionally vague for security).
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.id})
    return Token(access_token=token, user=UserResponse.model_validate(user))


# ── Current user ──────────────────────────────────────────────────────────────
# Used by the frontend's OAuth callback page: after the backend redirects back
# with a fresh token, the page stores it and calls this to fetch the user.

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's account details."""
    return UserResponse.model_validate(current_user)


# ── Password reset ────────────────────────────────────────────────────────────

def _allow_plaintext_reset_link() -> bool:
    """Dev-mode guard: may the reset link ride in the API response?

    Locally (no SMTP configured) we return the link so the whole flow is
    testable without email infrastructure. But if this ever runs on Render
    without SMTP, exposing the link in the response would let anyone who knows
    an email address reset that account's password — so on Render the link is
    always dropped and we log the misconfiguration instead.
    """
    return not os.environ.get("RENDER")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Start a password reset for the given email. If the account exists (and has
    a password — OAuth-only accounts can't reset one), email a one-time reset
    link; otherwise do nothing.

    The response is deliberately identical whether or not the email exists, so
    an attacker can't use this endpoint to enumerate registered accounts.
    """
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()

    reset_link = None
    if user is not None and user.hashed_password is not None:
        # A signed, short-lived token scoped to password reset only — the same
        # JWT machinery as login, with a `typ` claim so it can never be used as
        # an ordinary access token.
        token = create_access_token(
            {"sub": user.id, "typ": "password_reset"},
            expires_delta=timedelta(hours=1),
        )
        reset_link = send_reset_link(
            user.email,
            f"{frontend_url()}/auth/reset-password?token={token}",
        )
        # Dev-mode only: never leak the link through the API on Render.
        if reset_link is not None and not _allow_plaintext_reset_link():
            log.warning(
                "SMTP_HOST is not set but RENDER is — dropping a password reset link "
                "that should have been emailed."
            )
            reset_link = None

    return ForgotPasswordResponse(
        message="If an account exists for that email, a reset link is on its way.",
        reset_link=reset_link,  # only populated in dev mode (no SMTP configured)
    )


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Set a new password using a reset token from the forgot-password email."""
    try:
        payload = decode_access_token(body.token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That reset link is invalid or has expired. Please request a new one.",
        )

    # A reset token is only valid for this purpose — reject plain login tokens.
    if payload.get("typ") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That reset link is invalid or has expired. Please request a new one.",
        )

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That reset link is invalid or has expired. Please request a new one.",
        )

    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Password must be at least 8 characters.",
        )

    user.hashed_password = hash_password(body.password)
    db.commit()
    return {"message": "Password reset. You can now sign in with your new password."}
