"""
backend/database.py
SQLAlchemy engine and session factory for the Formix backend.

Uses DATABASE_URL from the environment when set (e.g. a Postgres/Neon URL in
production — see render.yaml / init_db.py), and otherwise falls back to a
local SQLite file (formix.db) stored alongside this package for local dev.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Place the DB file next to this file, regardless of where uvicorn is launched from.
_HERE = os.path.dirname(os.path.abspath(__file__))
_SQLITE_URL = f"sqlite:///{os.path.join(_HERE, 'formix.db')}"

def _normalise_database_url(url: str) -> str:
    """Match provider URLs to the PostgreSQL driver installed by Formix."""
    url = url.strip()
    if url.startswith("postgres://"):
        # Some providers still hand out the legacy scheme.
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg://"):
        # Render/Neon may explicitly select psycopg v3, while Formix installs
        # psycopg2-binary. Keep one driver dependency instead of installing a
        # second PostgreSQL adapter solely to accept this URL spelling.
        url = url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
    return url


_env_url = _normalise_database_url(os.environ.get("DATABASE_URL", ""))

DATABASE_URL = _env_url or _SQLITE_URL

# connect_args is SQLite-specific: allows the same connection to be used
# across multiple threads (FastAPI uses a thread pool). Postgres doesn't
# accept this kwarg, so only pass it when we're actually on SQLite.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=not DATABASE_URL.startswith("sqlite"),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db():
    """FastAPI dependency that yields a DB session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
