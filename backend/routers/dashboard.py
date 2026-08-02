"""
backend/routers/dashboard.py
Aggregate, cross-project dashboard endpoints for the Formix API.

  GET /dashboard/summary — totals for the current user
  GET /dashboard/forms   — every form the current user owns, across all of
                           their projects, with per-form stats

All routes require authentication and are scoped to the current user's own
projects/forms/submissions (no cross-user data is ever visible).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Form, Project, Submission, User
from ..schemas import AnalyticsDayCount, DashboardActivity, DashboardFormRow, DashboardSummary

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cross-project totals for the current user."""
    total_projects = (
        db.query(func.count(Project.id))
        .filter(Project.owner_id == current_user.id)
        .scalar()
    ) or 0

    # One query for both form counts instead of two — a conditional sum
    # avoids a second full join+filter over the same rows.
    total_forms, published_forms = (
        db.query(
            func.count(Form.id),
            func.coalesce(func.sum(case((Form.is_published == True, 1), else_=0)), 0),
        )
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .one()
    )

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    since = now - timedelta(days=7)

    # Likewise, one query for all three submission counts via conditional sums.
    total_submissions, today_responses, submissions_last_7_days = (
        db.query(
            func.count(Submission.id),
            func.coalesce(func.sum(case((Submission.submitted_at >= today_start, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Submission.submitted_at >= since, 1), else_=0)), 0),
        )
        .join(Form, Submission.form_id == Form.id)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .one()
    )

    return DashboardSummary(
        total_projects=total_projects,
        total_forms=total_forms,
        published_forms=int(published_forms),
        total_submissions=total_submissions,
        today_responses=int(today_responses),
        submissions_last_7_days=int(submissions_last_7_days),
    )


@router.get("/dashboard/forms", response_model=list[DashboardFormRow])
def dashboard_forms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Every form owned by the current user, across all of their projects, each
    annotated with its submission count and most recent response time —
    backs the dashboard's form list table (one call, no N+1 per-form fetch).
    """
    rows = (
        db.query(Form, Project.title)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .order_by(Form.updated_at.desc())
        .all()
    )

    stat_rows = (
        db.query(
            Submission.form_id,
            func.count(Submission.id),
            func.max(Submission.submitted_at),
        )
        .join(Form, Submission.form_id == Form.id)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .group_by(Submission.form_id)
        .all()
    )
    stats = {form_id: (count, last_at) for form_id, count, last_at in stat_rows}

    return [
        DashboardFormRow(
            id=form.id,
            title=form.title,
            project_id=form.project_id,
            project_title=project_title,
            is_published=form.is_published,
            duplicate_mode=form.duplicate_mode,
            created_at=form.created_at,
            updated_at=form.updated_at,
            submission_count=stats.get(form.id, (0, None))[0],
            last_response_at=stats.get(form.id, (0, None))[1],
        )
        for form, project_title in rows
    ]


@router.get("/dashboard/activity", response_model=DashboardActivity)
def dashboard_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chart data for the dashboard's activity row, one call for all three:

      - forms_by_day       : forms created per calendar day (last 30 days)
      - submissions_by_day : responses received per calendar day (last 30 days)
      - top_forms          : the user's 5 most-responded forms (reuses the same
                             DashboardFormRow shape the table already renders)

    Returns dense, zero-filled day series so the frontend charts don't have to
    fill gaps themselves.
    """
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)

    # ── forms_by_day ──────────────────────────────────────────────────────────
    form_rows = (
        db.query(Form.created_at)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id, Form.created_at >= start)
        .all()
    )
    forms_by_day: dict[str, int] = {}
    for (created_at,) in form_rows:
        day = created_at.date().isoformat()
        forms_by_day[day] = forms_by_day.get(day, 0) + 1

    # ── submissions_by_day ────────────────────────────────────────────────────
    submission_rows = (
        db.query(Submission.submitted_at)
        .join(Form, Submission.form_id == Form.id)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id, Submission.submitted_at >= start)
        .all()
    )
    submissions_by_day: dict[str, int] = {}
    for (submitted_at,) in submission_rows:
        day = submitted_at.date().isoformat()
        submissions_by_day[day] = submissions_by_day.get(day, 0) + 1

    # Zero-fill both series for the full 30-day window.
    forms_series = []
    submissions_series = []
    for i in range(30):
        day = (start + timedelta(days=i)).date().isoformat()
        forms_series.append(AnalyticsDayCount(date=day, count=forms_by_day.get(day, 0)))
        submissions_series.append(AnalyticsDayCount(date=day, count=submissions_by_day.get(day, 0)))

    # ── top_forms ─────────────────────────────────────────────────────────────
    top = (
        db.query(
            Submission.form_id,
            func.count(Submission.id).label("count"),
        )
        .join(Form, Submission.form_id == Form.id)
        .join(Project, Form.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
        .group_by(Submission.form_id)
        .order_by(func.count(Submission.id).desc())
        .limit(5)
        .all()
    )
    top_ids = [form_id for form_id, _count in top]
    top_count = {form_id: count for form_id, count in top}

    top_forms = []
    if top_ids:
        forms = (
            db.query(Form, Project.title)
            .join(Project, Form.project_id == Project.id)
            .filter(Form.id.in_(top_ids))
            .all()
        )
        top_forms = [
            DashboardFormRow(
                id=form.id,
                title=form.title,
                project_id=form.project_id,
                project_title=project_title,
                is_published=form.is_published,
                duplicate_mode=form.duplicate_mode,
                created_at=form.created_at,
                updated_at=form.updated_at,
                submission_count=top_count.get(form.id, 0),
                last_response_at=None,
            )
            for form, project_title in forms
        ]

    return DashboardActivity(
        forms_by_day=forms_series,
        submissions_by_day=submissions_series,
        top_forms=top_forms,
    )
