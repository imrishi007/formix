"""
remove_seed_data.py
Removes everything created by seed_data.py — and only that.

Deletes the single seed-data user (seed-data@formix.local); the existing
cascade="all, delete-orphan" relationships (User -> Project -> Form ->
Submission, see backend/models.py) take care of every project, form, and
submission underneath it. No other account is touched.

Run from the repo root:
    python remove_seed_data.py
"""

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from backend.database import SessionLocal  # noqa: E402
from backend.models import Form, Project, Submission, User  # noqa: E402
from seed_data import SEED_EMAIL  # noqa: E402 -- single source of truth for the seed account


def main():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == SEED_EMAIL).first()
        if not user:
            print(f"No seed user found ({SEED_EMAIL}) — nothing to remove.")
            return

        project_ids = [p.id for p in db.query(Project).filter(Project.owner_id == user.id).all()]
        form_ids = [f.id for f in db.query(Form).filter(Form.project_id.in_(project_ids)).all()] if project_ids else []
        submission_count = (
            db.query(Submission).filter(Submission.form_id.in_(form_ids)).count() if form_ids else 0
        )

        print(f"Removing seed user {SEED_EMAIL} ({user.id})")
        print(f"  {len(project_ids)} project(s), {len(form_ids)} form(s), {submission_count} submission(s)")

        db.delete(user)  # cascades to projects -> forms -> submissions
        db.commit()

        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
