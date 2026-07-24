"""
backend/deps.py
Shared FastAPI ownership-check dependencies, used by both routers/projects.py
and routers/forms.py so author routes enforce ownership consistently instead
of each router re-implementing its own version.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from .models import Form, Project, User


def get_project_or_403(project_id: str, user: User, db: Session) -> Project:
    """Load a project and verify the requesting user is the owner."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="You do not have access to this project")
    return project


def get_form_or_403(form_id: str, user: User, db: Session) -> Form:
    """Load a form and verify the requesting user owns its parent project."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail="Form not found")
    project = db.query(Project).filter(Project.id == form.project_id).first()
    if not project or project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="You do not have access to this form")
    return form
