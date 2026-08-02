"""
backend/routers/profile.py
Author profile endpoints for the Formix API.

  GET   /profile  — the current user's account info + aggregate stats + the
                    forms-created-per-day series backing the profile page's
                    GitHub-style yearly heatmap
  PATCH /profile  — update editable profile fields (name, avatar_url)

Both routes require authentication and operate on the current user only.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Form, Project, Submission, User
from ..schemas import ProfileDayCount, ProfileResponse, ProfileUpdate, UserResponse

router = APIRouter(prefix="/profile", tags=["profile"])

# How many days of the forms-created series the heatmap needs. GitHub-style
# heatmaps show one full year; older forms simply fall outside the window.
YEAR_DAYS = 365


def _forms_by_day(db: Session, user_id: str, days: int) -> list[ProfileDayCount]:
    """Bucket the user's forms by created date for the last `days` calendar days.

    Returns a dense (zero-filled) series from `days` days ago through today so
    the frontend heatmap doesn't have to fill gaps itself — the same by_day
    dict approach used by routers/forms.py's analytics.
    """
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    forms = (
        db.query(Form.created_at)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == user_id, Form.created_at >= start)
        .all()
    )

    by_day: dict[str, int] = {}
    for (created_at,) in forms:
        day = created_at.date().isoformat()
        by_day[day] = by_day.get(day, 0) + 1

    # Zero-fill every day in the window so the heatmap grid is always full.
    result = []
    for i in range(days):
        day = (start + timedelta(days=i)).date().isoformat()
        result.append(ProfileDayCount(date=day, count=by_day.get(day, 0)))
    return result


@router.get("", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's profile: account info, totals, and the
    yearly forms-created series for the heatmap."""
    total_forms, published_forms = (
        db.query(
            func.count(Form.id),
            func.coalesce(func.sum(case((Form.is_published == True, 1), else_=0)), 0),
        )
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .one()
    )

    total_submissions = (
        db.query(func.count(Submission.id))
        .join(Form, Submission.form_id == Form.id)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .scalar()
    ) or 0

    return ProfileResponse(
        user=UserResponse.model_validate(current_user),
        member_since=current_user.created_at,
        total_forms=total_forms,
        published_forms=int(published_forms),
        total_submissions=total_submissions,
        forms_by_day=_forms_by_day(db, current_user.id, YEAR_DAYS),
    )


@router.patch("", response_model=UserResponse)
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update editable profile fields. Only fields explicitly sent are changed;
    `None` leaves an existing value untouched (name/avatar_url are optional)."""
    if body.name is not None:
        current_user.name = body.name.strip() or None
    if body.avatar_url is not None:
        # Keep a 2MB ceiling so a misbehaving client can't stuff an oversized
        # data URL into the users table.
        if len(body.avatar_url) > 2_000_000:
            current_user.avatar_url = None
        else:
            current_user.avatar_url = body.avatar_url or None
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
