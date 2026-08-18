"""add email verification for registration

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-08-16 16:50:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "y9z0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_email_verification_tokens_id"),
        "email_verification_tokens",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_verification_tokens_member_id"),
        "email_verification_tokens",
        ["member_id"],
        unique=False,
    )
    # Grandfather existing approved accounts so live pilots keep working.
    op.execute(
        sa.text(
            "UPDATE users SET email_verified_at = CURRENT_TIMESTAMP "
            "WHERE email_verified_at IS NULL AND status = 'approved'"
        )
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_email_verification_tokens_member_id"),
        table_name="email_verification_tokens",
    )
    op.drop_index(
        op.f("ix_email_verification_tokens_id"),
        table_name="email_verification_tokens",
    )
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "email_verified_at")
