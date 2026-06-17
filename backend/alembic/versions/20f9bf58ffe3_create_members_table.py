"""create members table

Revision ID: 20f9bf58ffe3
Revises:
Create Date: 2026-06-17 08:39:43.884974

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20f9bf58ffe3"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

memberrole = postgresql.ENUM(
    "president",
    "treasurer",
    "board",
    "general",
    name="memberrole",
    create_type=False,
)
memberstatus = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="memberstatus",
    create_type=False,
)


def upgrade() -> None:
    memberrole.create(op.get_bind(), checkfirst=True)
    memberstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", memberrole, nullable=False),
        sa.Column("status", memberstatus, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_members_id"), "members", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_members_id"), table_name="members")
    op.drop_table("members")
    memberstatus.drop(op.get_bind(), checkfirst=True)
    memberrole.drop(op.get_bind(), checkfirst=True)
