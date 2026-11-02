"""Small project-collaboration surface: invite existing users and assign roles."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..deps import get_project_or_403
from ..models import ProjectMember, User
from ..schemas import ProjectMemberCreate, ProjectMemberResponse, ProjectMemberUpdate


router = APIRouter(tags=["teams"])


def _response(member: ProjectMember, role: str | None = None) -> ProjectMemberResponse:
    return ProjectMemberResponse(
        id=member.id,
        user_id=member.user.id,
        email=member.user.email,
        name=member.user.name,
        role=role or member.role,
        created_at=member.created_at,
    )


@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberResponse])
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_403(project_id, current_user, db)
    owner = ProjectMemberResponse(
        id=f"owner:{project.owner.id}",
        user_id=project.owner.id,
        email=project.owner.email,
        name=project.owner.name,
        role="owner",
        created_at=project.created_at,
    )
    return [owner] + [
        _response(member)
        for member in sorted(project.members, key=lambda item: item.created_at)
    ]


@router.post("/projects/{project_id}/members", response_model=ProjectMemberResponse, status_code=201)
def add_member(
    project_id: str,
    body: ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_403(project_id, current_user, db, "owner")
    invited = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not invited:
        raise HTTPException(status_code=404, detail="That email does not have a Formix account yet")
    if invited.id == project.owner_id:
        raise HTTPException(status_code=409, detail="The project owner is already a member")
    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == invited.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This user is already a project member")
    member = ProjectMember(project_id=project.id, user_id=invited.id, role=body.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return _response(member)


@router.patch("/projects/{project_id}/members/{member_id}", response_model=ProjectMemberResponse)
def update_member(
    project_id: str,
    member_id: str,
    body: ProjectMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_403(project_id, current_user, db, "owner")
    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id, ProjectMember.project_id == project.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")
    member.role = body.role
    db.commit()
    db.refresh(member)
    return _response(member)


@router.delete("/projects/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_403(project_id, current_user, db, "owner")
    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id, ProjectMember.project_id == project.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")
    db.delete(member)
    db.commit()
