"""
init_db.py
One-shot script to create all Formix tables in a fresh PostgreSQL database.

Run this ONCE after setting up your Neon (or any Postgres) database:

    # Option A — pass the connection string directly on the command line
    python init_db.py "postgresql://user:password@host/dbname?sslmode=require"

    # Option B — set DATABASE_URL in the environment (or in backend/.env),
    #             then run without arguments
    DATABASE_URL="postgresql://..." python init_db.py

Tables created (in dependency order):
    users        — author accounts
    projects     — named containers owned by one user
    forms        — form definitions; belongs to a project; optional sequential link
    submissions  — respondent answer payloads; belongs to a form

This script is safe to re-run: SQLAlchemy's create_all uses CREATE TABLE IF NOT
EXISTS semantics, so existing tables are never dropped or modified.

NOTE: Run this from the project root (the directory that contains the 'backend/'
package), NOT from inside backend/ itself.

    cd c:\\Users\\Rishi\\Downloads\\formix
    python init_db.py "postgresql://..."
"""

import sys
import os
from pathlib import Path

# ── Allow running from the repo root without installing the package ───────────
# Insert the project root (parent of backend/) into sys.path so that
# `from backend.X import Y` works without `pip install -e .`.
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# ── Load backend/.env so DATABASE_URL can be stored there locally ─────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / "backend" / ".env")
except ImportError:
    pass  # python-dotenv not available; rely on env vars being set externally

# ── Accept DATABASE_URL from the command line (overrides env / .env) ──────────
if len(sys.argv) == 2:
    os.environ["DATABASE_URL"] = sys.argv[1]

# ── Validate DATABASE_URL ─────────────────────────────────────────────────────
_url: str = os.environ.get("DATABASE_URL", "")
if not _url:
    print(
        "ERROR: DATABASE_URL is not set.\n"
        "Usage:\n"
        '  python init_db.py "postgresql://user:password@host/dbname?sslmode=require"\n'
        "or set DATABASE_URL in the environment before running.",
        file=sys.stderr,
    )
    sys.exit(1)

# Normalise postgres:// -> postgresql:// (Neon URLs sometimes use the old form)
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

print("Connecting to PostgreSQL ...")
from sqlalchemy import create_engine, text

engine = create_engine(_url, pool_pre_ping=True)

# Import models so SQLAlchemy registers them against the Base metadata.
# The DATABASE_URL env var is already set above, so database.py won't raise.
from backend.models import Base  # noqa: F401 -- side-effect import (registers all models)

# ── Create tables ─────────────────────────────────────────────────────────────
print("Creating tables (IF NOT EXISTS) ...")
Base.metadata.create_all(bind=engine)

# Verify by listing tables in the public schema
with engine.connect() as conn:
    result = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
    )
    tables = [row[0] for row in result]

print("Done! Tables in the public schema:")
for t in tables:
    print(f"  v {t}")
