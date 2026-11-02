"""
backend/deps.py
Shared FastAPI ownership-check dependencies, used by both routers/projects.py
and routers/forms.py so author routes enforce ownership consistently instead
of each router re-implementing its own version.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from .models import Form, Project, ProjectMember, User


ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}


def get_project_role(project: Project, user: User, db: Session) -> str | None:
    if project.owner_id == user.id:
        return "owner"
    membership = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
        .first()
    )
    return membership.role if membership else None


def get_project_or_403(
    project_id: str,
    user: User,
    db: Session,
    minimum_role: str = "viewer",
) -> Project:
    """Load a project and enforce the shared owner/editor/viewer policy once."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail="Project not found")
    role = get_project_role(project, user, db)
    if role is None or ROLE_RANK[role] < ROLE_RANK[minimum_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="You do not have access to this project")
    return project


def get_form_or_403(
    form_id: str,
    user: User,
    db: Session,
    minimum_role: str = "viewer",
) -> Form:
    """Load a form and enforce its parent project's collaborator role."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail="Form not found")
    project = db.query(Project).filter(Project.id == form.project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    role = get_project_role(project, user, db)
    if role is None or ROLE_RANK[role] < ROLE_RANK[minimum_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="You do not have access to this form")
    return form
