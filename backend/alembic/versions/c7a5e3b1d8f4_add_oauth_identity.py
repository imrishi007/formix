"""add oauth identity columns

Revision ID: c7a5e3b1d8f4
Revises: f3b9c1a4d2e7
Create Date: 2026-08-02 15:00:00.000000

Adds the columns backing "Continue with Google / GitHub" OAuth logins:

  - oauth_provider : which provider the identity came from ("google"/"github")
  - oauth_subject  : the provider's immutable user id (Google `sub`, GitHub `id`)
  - hashed_password made nullable — OAuth-only accounts have no password, and
    the email/password login path already fails safely for them (verify_password
    returns False on a NULL hash).

The unique constraint on (oauth_provider, oauth_subject) is what makes
find-or-create idempotent: the same Google account can never create two
Formix users.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7a5e3b1d8f4"
down_revision: Union[str, Sequence[str], None] = "f3b9c1a4d2e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("oauth_provider", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("oauth_subject", sa.String(length=255), nullable=True))
        # OAuth-only users have no password; email+password logins still work
        # for everyone else because verify_password() fails safely on NULL.
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=True)
        batch_op.create_unique_constraint("uq_users_oauth_provider_subject", ["oauth_provider", "oauth_subject"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_oauth_provider_subject", type_="unique")
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=False)
        batch_op.drop_column("oauth_subject")
        batch_op.drop_column("oauth_provider")
