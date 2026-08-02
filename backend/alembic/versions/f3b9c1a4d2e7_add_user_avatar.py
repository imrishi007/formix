"""add user avatar_url

Revision ID: f3b9c1a4d2e7
Revises: a1c4e2f0b9d7
Create Date: 2026-08-02 14:00:00.000000

Adds the author profile-picture column backing /profile (see
backend/models.py User.avatar_url and routers/profile.py).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3b9c1a4d2e7"
down_revision: Union[str, Sequence[str], None] = "a1c4e2f0b9d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the avatar_url column (nullable — most users won't have one yet)."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("avatar_url", sa.Text(), nullable=True))


def downgrade() -> None:
    """Drop the avatar_url column."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("avatar_url")
