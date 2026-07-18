"""
backend/main.py
FastAPI application entry point for the Formix backend.

Run with:
    uvicorn backend.main:app --reload --port 8000

(from the project root: c:\\Users\\Rishi\\Desktop\\Foxmix\\formix)

Environment:
    Copy backend/.env.example to backend/.env and set FORMIX_JWT_SECRET
    before starting the server.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from the backend/ directory (if present) before any other imports
# that might read env vars.  python-dotenv is a no-op if the file is absent.
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).parent / ".env"
    load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv not installed yet; will be after pip install -r requirements.txt

from .database import Base, engine
from .routers import forms as forms_router
from .routers import auth as auth_router
from .routers import projects as projects_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup if they don't exist yet.
    # SQLAlchemy's create_all is idempotent — safe to call every time.
    Base.metadata.create_all(bind=engine)
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


@app.get("/health")
def health():
    """Quick liveness check."""
    return {"status": "ok", "version": "0.2.0"}
