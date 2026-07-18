"""
backend/database.py
SQLAlchemy engine and session factory for the Formix backend.
Uses a local SQLite file (formix.db) stored alongside this package.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Place the DB file next to this file, regardless of where uvicorn is launched from.
_HERE = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(_HERE, 'formix.db')}"

# connect_args is SQLite-specific: allows the same connection to be used
# across multiple threads (FastAPI uses a thread pool).
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
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
