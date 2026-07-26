"""add member and group avatar columns

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-07-25 20:55:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, Sequence[str], None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=2048), nullable=True))
    op.add_column(
        "users",
        sa.Column("avatar_public_id", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "discussion_rooms",
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "discussion_rooms",
        sa.Column("avatar_public_id", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("discussion_rooms", "avatar_public_id")
    op.drop_column("discussion_rooms", "avatar_url")
    op.drop_column("users", "avatar_public_id")
    op.drop_column("users", "avatar_url")
