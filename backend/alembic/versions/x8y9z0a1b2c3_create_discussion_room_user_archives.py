"""create discussion room user archives (personal archive-for-me)

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-08-07 10:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "x8y9z0a1b2c3"
down_revision: Union[str, Sequence[str], None] = "w7x8y9z0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_room_user_archives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_room_user_archives_user_room",
        ),
    )
    op.create_index(
        op.f("ix_discussion_room_user_archives_id"),
        "discussion_room_user_archives",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_user_archives_user_id"),
        "discussion_room_user_archives",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_user_archives_room_id"),
        "discussion_room_user_archives",
        ["room_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_room_user_archives_room_id"),
        table_name="discussion_room_user_archives",
    )
    op.drop_index(
        op.f("ix_discussion_room_user_archives_user_id"),
        table_name="discussion_room_user_archives",
    )
    op.drop_index(
        op.f("ix_discussion_room_user_archives_id"),
        table_name="discussion_room_user_archives",
    )
    op.drop_table("discussion_room_user_archives")
