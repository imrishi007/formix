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

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
    # Schema is managed by Alembic migrations (see backend/alembic/versions/),
    # not created here — run `alembic upgrade head` before starting the server.
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
# Allow all origins for local development.  Tighten to specific domains before
# any production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
