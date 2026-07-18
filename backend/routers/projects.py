"""
backend/routers/projects.py
Project and project-scoped form endpoints for the Formix API.
All routes require authentication (get_current_user dependency).

  POST   /projects              — create a project
  GET    /projects              — list current user's projects
  GET    /projects/{id}         — project details + form summaries
  POST   /projects/{id}/forms   — create a form inside a project
  PATCH  /forms/{id}/link       — set / clear Form.next_form_id
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Form, Project, User
from ..schemas import (
    FormCreateInProject,
    FormCreateResponse,
    FormLinkRequest,
    ProjectCreate,
    ProjectDetail,
    ProjectResponse,
)

router = APIRouter(tags=["projects"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_project_or_403(project_id: str, user: User, db: Session) -> Project:
    """Load a project and verify the requesting user is the owner."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You do not have access to this project")
    return project


def _get_form_or_403(form_id: str, user: User, db: Session) -> Form:
    """Load a form and verify the requesting user owns its parent project."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Form not found")
    # Verify ownership via the project
    project = db.query(Project).filter(Project.id == form.project_id).first()
    if not project or project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You do not have access to this form")
    return form


# ── Project endpoints ─────────────────────────────────────────────────────────

@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new project owned by the current user."""
    project = Project(owner_id=current_user.id, title=body.title)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all projects owned by the current user, newest first."""
    return (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return project details including lightweight form summaries (no compiled_schema).
    403 if the requester is not the owner.
    """
    project = _get_project_or_403(project_id, current_user, db)
    return project


# ── Form creation inside a project ───────────────────────────────────────────

@router.post("/projects/{project_id}/forms", response_model=FormCreateResponse, status_code=201)
def create_form_in_project(
    project_id: str,
    body: FormCreateInProject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new form inside the specified project.
    403 if the current user is not the project owner.
    """
    _get_project_or_403(project_id, current_user, db)

    form = Form(
        project_id=project_id,
        title=body.title,
        forml_source=body.forml_source,
        compiled_schema=body.compiled_schema,
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


# ── Form linking ──────────────────────────────────────────────────────────────

@router.patch("/forms/{form_id}/link", status_code=200)
def link_form(
    form_id: str,
    body: FormLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Set or clear Form.next_form_id to create/remove a sequential link.

    Rules:
      - The source form must belong to the current user's project.
      - If next_form_id is provided (not None), the target form must also exist
        and belong to the same owner.
      - A form cannot link to itself.
    """
    source = _get_form_or_403(form_id, current_user, db)

    if body.next_form_id is None:
        # Unlink
        source.next_form_id = None
        db.commit()
        return {"ok": True, "next_form_id": None}

    if body.next_form_id == form_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A form cannot link to itself",
        )

    # Validate the target form belongs to the same owner
    target = db.query(Form).filter(Form.id == body.next_form_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Target form not found")

    target_project = db.query(Project).filter(Project.id == target.project_id).first()
    if not target_project or target_project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Target form does not belong to the same owner",
        )

    source.next_form_id = body.next_form_id
    db.commit()
    return {"ok": True, "next_form_id": source.next_form_id}
