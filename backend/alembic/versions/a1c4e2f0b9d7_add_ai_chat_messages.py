"""add ai_chat_messages

Revision ID: a1c4e2f0b9d7
Revises: e924d259facc
Create Date: 2026-08-02 10:00:00.000000

Adds the per-form AI conversation history table backing the LLM-backed
Formix AI chat (see backend/models.py AiChatMessage and routers/ai.py).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1c4e2f0b9d7"
down_revision: Union[str, Sequence[str], None] = "e924d259facc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the ai_chat_messages table."""
    op.create_table(
        "ai_chat_messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("form_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("revised_source", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("ai_chat_messages") as batch_op:
        batch_op.create_index(
            "ix_ai_chat_messages_form_id", ["form_id"], unique=False
        )


def downgrade() -> None:
    """Drop the ai_chat_messages table."""
    with op.batch_alter_table("ai_chat_messages") as batch_op:
        batch_op.drop_index("ix_ai_chat_messages_form_id")
    op.drop_table("ai_chat_messages")
