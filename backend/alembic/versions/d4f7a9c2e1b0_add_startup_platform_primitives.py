"""add releases, environments, drafts, collaborators, and durable webhooks

Revision ID: d4f7a9c2e1b0
Revises: c7a5e3b1d8f4
Create Date: 2026-11-02 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4f7a9c2e1b0"
down_revision: Union[str, Sequence[str], None] = "c7a5e3b1d8f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_members",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    op.create_table(
        "form_releases",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("form_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("forml_source", sa.Text(), nullable=False),
        sa.Column("compiled_schema", sa.JSON(), nullable=False),
        sa.Column("created_by_id", sa.String(), nullable=False),
        sa.Column("note", sa.String(length=280), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("form_id", "version", name="uq_form_releases_form_version"),
    )
    op.create_index("ix_form_releases_form_id", "form_releases", ["form_id"])

    with op.batch_alter_table("forms") as batch_op:
        batch_op.add_column(sa.Column("preview_token", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("active_preview_release_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("active_production_release_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("release_counter", sa.Integer(), server_default="0", nullable=False))
        batch_op.create_index("ix_forms_preview_token", ["preview_token"], unique=True)
        batch_op.create_index("ix_forms_active_preview_release_id", ["active_preview_release_id"])
        batch_op.create_index("ix_forms_active_production_release_id", ["active_production_release_id"])

    with op.batch_alter_table("submissions") as batch_op:
        batch_op.add_column(sa.Column("form_release_id", sa.String(), nullable=True))
        batch_op.create_foreign_key("fk_submissions_form_release", "form_releases", ["form_release_id"], ["id"])
        batch_op.create_index("ix_submissions_form_release_id", ["form_release_id"])

    op.create_table(
        "form_drafts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("form_id", sa.String(), nullable=False),
        sa.Column("release_id", sa.String(), nullable=True),
        sa.Column("resume_token", sa.String(length=96), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("current_page", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["release_id"], ["form_releases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_form_drafts_form_id", "form_drafts", ["form_id"])
    op.create_index("ix_form_drafts_resume_token", "form_drafts", ["resume_token"], unique=True)

    op.create_table(
        "webhook_endpoints",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("form_id", sa.String(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("secret", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_webhook_endpoints_form_id", "webhook_endpoints", ["form_id"])

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("webhook_id", sa.String(), nullable=False),
        sa.Column("submission_id", sa.String(), nullable=False),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["webhook_id"], ["webhook_endpoints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_webhook_deliveries_webhook_id", "webhook_deliveries", ["webhook_id"])
    op.create_index("ix_webhook_deliveries_submission_id", "webhook_deliveries", ["submission_id"])
    op.create_index("ix_webhook_deliveries_status", "webhook_deliveries", ["status"])


def downgrade() -> None:
    op.drop_table("webhook_deliveries")
    op.drop_table("webhook_endpoints")
    op.drop_table("form_drafts")
    with op.batch_alter_table("submissions") as batch_op:
        batch_op.drop_index("ix_submissions_form_release_id")
        batch_op.drop_constraint("fk_submissions_form_release", type_="foreignkey")
        batch_op.drop_column("form_release_id")
    with op.batch_alter_table("forms") as batch_op:
        batch_op.drop_index("ix_forms_active_production_release_id")
        batch_op.drop_index("ix_forms_active_preview_release_id")
        batch_op.drop_index("ix_forms_preview_token")
        batch_op.drop_column("release_counter")
        batch_op.drop_column("active_production_release_id")
        batch_op.drop_column("active_preview_release_id")
        batch_op.drop_column("preview_token")
    op.drop_table("form_releases")
    op.drop_table("project_members")
