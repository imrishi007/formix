"""create initial schema (users, projects, forms, submissions)

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-30 00:00:00.000000

This is the baseline migration.  It creates every table that existed
*before* Alembic was introduced so that the subsequent migration
(e924d259facc) can run safely on a brand-new Neon (or any PostgreSQL)
database without hitting "table does not exist" errors.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_index("ix_users_email", ["email"], unique=True)

    # ── projects ───────────────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("projects") as batch_op:
        batch_op.create_index("ix_projects_owner_id", ["owner_id"], unique=False)

    # ── forms ──────────────────────────────────────────────────────────────────
    op.create_table(
        "forms",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("forml_source", sa.Text(), nullable=False),
        sa.Column("compiled_schema", sa.JSON(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("next_form_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["next_form_id"], ["forms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("forms") as batch_op:
        batch_op.create_index("ix_forms_project_id", ["project_id"], unique=False)

    # ── submissions ────────────────────────────────────────────────────────────
    op.create_table(
        "submissions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("form_id", sa.String(), nullable=False),
        sa.Column("respondent_session_id", sa.String(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("submissions") as batch_op:
        batch_op.create_index("ix_submissions_form_id", ["form_id"], unique=False)
        batch_op.create_index(
            "ix_submissions_respondent_session_id",
            ["respondent_session_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_table("submissions")
    op.drop_table("forms")
    op.drop_table("projects")
    op.drop_table("users")
