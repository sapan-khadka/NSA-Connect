"""create discussion_room_archives for board/event archive

Revision ID: i7d8e9f0a1b2
Revises: h6c7d8e9f0a1
Create Date: 2026-07-20 10:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i7d8e9f0a1b2"
down_revision: Union[str, Sequence[str], None] = "h6c7d8e9f0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_room_archives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column("archived_by_id", sa.Integer(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["archived_by_id"],
            ["members.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_id"),
    )
    op.create_index(
        op.f("ix_discussion_room_archives_id"),
        "discussion_room_archives",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_archives_room_id"),
        "discussion_room_archives",
        ["room_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_archives_archived_by_id"),
        "discussion_room_archives",
        ["archived_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_room_archives_archived_by_id"),
        table_name="discussion_room_archives",
    )
    op.drop_index(
        op.f("ix_discussion_room_archives_room_id"),
        table_name="discussion_room_archives",
    )
    op.drop_index(
        op.f("ix_discussion_room_archives_id"),
        table_name="discussion_room_archives",
    )
    op.drop_table("discussion_room_archives")
