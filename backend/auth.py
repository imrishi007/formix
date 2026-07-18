"""
backend/auth.py
Authentication utilities for Formix:
  - Password hashing / verification via bcrypt (direct — passlib not used)
  - JWT creation / decoding via python-jose
  - FastAPI dependency `get_current_user` that validates the Bearer token
    and returns the authenticated User ORM object.

Configuration (read from environment / .env):
  FORMIX_JWT_SECRET         — required, long random string
  FORMIX_JWT_ALGORITHM      — default HS256
  FORMIX_JWT_EXPIRE_MINUTES — default 60
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt as _bcrypt_lib
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

# ── Config ────────────────────────────────────────────────────────────────────

def _get_secret() -> str:
    secret = os.environ.get("FORMIX_JWT_SECRET", "")
    if not secret:
        raise RuntimeError(
            "FORMIX_JWT_SECRET environment variable is not set. "
            "Copy backend/.env.example to backend/.env and fill in the value."
        )
    return secret


ALGORITHM: str = os.environ.get("FORMIX_JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES: int = int(os.environ.get("FORMIX_JWT_EXPIRE_MINUTES", "60"))

# ── Password hashing (direct bcrypt — avoids passlib/bcrypt 5.x incompatibility) ──

def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt. Returns a utf-8 string."""
    return _bcrypt_lib.hashpw(plain.encode("utf-8"), _bcrypt_lib.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return _bcrypt_lib.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, _get_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT.  Raises HTTPException 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


# ── FastAPI dependency ────────────────────────────────────────────────────────

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency.  Validates the Bearer JWT and returns the User ORM object.
    Raises 401 if the token is missing, invalid, or expired.
    Raises 401 if the user no longer exists in the database.
    """
    payload = decode_access_token(credentials.credentials)
    user_id: str = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
