"""
backend/main.py
FastAPI application entry point for the Formix backend.

Run with:
    uvicorn backend.main:app --reload --port 8000

(from the project root: c:\\Users\\Rishi\\Desktop\\Foxmix\\formix)

Environment:
    Copy backend/.env.example to backend/.env and set FORMIX_JWT_SECRET
    before starting the server.

Database schema:
    Schema is managed by Alembic, not by SQLAlchemy's create_all(). Before
    starting the server (fresh clone or after pulling model changes), run:
        cd backend && alembic upgrade head
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

log = logging.getLogger("formix")

# Load .env from the backend/ directory (if present) before any other imports
# that might read env vars.  python-dotenv is a no-op if the file is absent.
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).parent / ".env"
    load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv not installed yet; will be after pip install -r requirements.txt

from .routers import forms as forms_router
from .routers import auth as auth_router
from .routers import projects as projects_router
from .routers import dashboard as dashboard_router


UPLOAD_DIR = Path(__file__).parent / "uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run any pending Alembic migrations at startup so the schema is always
    # current.  Doing this here (rather than in the build command) guarantees
    # DATABASE_URL is already in the environment when the engine is created.
    try:
        from alembic import command as alembic_command
        from alembic.config import Config as AlembicConfig
        from sqlalchemy import inspect as sa_inspect

        from .database import engine  # reuse the already-configured engine

        _alembic_ini = Path(__file__).parent / "alembic.ini"
        _cfg = AlembicConfig(str(_alembic_ini))

        # ── Handle the "pre-Alembic" state ────────────────────────────────────
        # The base tables (users, projects, forms, submissions) were created
        # manually via init_db.py BEFORE Alembic was introduced.  If Alembic
        # has never tracked this DB (no alembic_version table) but the base
        # tables already exist, running upgrade from scratch would fail with
        # "relation already exists".  Instead, stamp the DB at the initial
        # revision so Alembic only applies the incremental migrations on top.
        insp = sa_inspect(engine)
        existing_tables = set(insp.get_table_names())
        alembic_already_tracking = "alembic_version" in existing_tables
        base_tables_exist = "users" in existing_tables

        if base_tables_exist and not alembic_already_tracking:
            log.info(
                "Pre-Alembic DB detected (base tables exist, no alembic_version). "
                "Stamping at '0001_initial_schema' before upgrading."
            )
            alembic_command.stamp(_cfg, "0001_initial_schema")

        alembic_command.upgrade(_cfg, "head")
        log.info("Alembic migrations applied successfully.")
    except Exception as exc:  # noqa: BLE001
        # Log but don't crash — a hard failure here would make the service
        # permanently unavailable on subsequent restarts.
        log.error("Alembic migration error (continuing): %s", exc, exc_info=True)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Formix API",
    description=(
        "Backend for the Formix form-builder: "
        "user auth, project management, form storage, publish, "
        "sequential submission flows, and submission handling."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# ALLOWED_ORIGINS env var: comma-separated list of allowed frontend origins.
# Set this in Render to your Vercel URL(s), e.g.:
#   ALLOWED_ORIGINS=https://formix.vercel.app,https://formix-xxx.vercel.app
# Falls back to localhost for local development.
#
# Render automatically sets RENDER_EXTERNAL_URL to the service's public URL
# (e.g. https://formix-j6ww.onrender.com). We add it automatically below so the
# API docs / direct browser access work from the Render URL itself.
#
# NOTE: "allow_origins=['*']" is incompatible with "allow_credentials=True"
# per the CORS spec — browsers reject that combo. We must list explicit origins.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else ["http://localhost:3000", "http://127.0.0.1:3000"]
)

# Auto-add the Render service's own external URL so direct browser access
# (e.g. visiting /docs or hitting the API from a tool like Postman via the
# Render URL) doesn't get blocked by CORS.
_render_url = os.environ.get("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
if _render_url and _render_url not in _allowed_origins:
    _allowed_origins.append(_render_url)

log.info("CORS allowed origins: %s", _allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)        # /auth/register, /auth/login
app.include_router(projects_router.router)    # /projects/*, /forms/{id}/link
app.include_router(forms_router.router)       # /forms/*, /submissions/by-session/*
app.include_router(dashboard_router.router)   # /dashboard/summary

# Serves respondent-uploaded files (resumes, photos, etc.) back by their
# stored URL — mounted after the routers so /forms/* etc. still take priority.
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    """Quick liveness check."""
    return {"status": "ok", "version": "0.2.0"}
