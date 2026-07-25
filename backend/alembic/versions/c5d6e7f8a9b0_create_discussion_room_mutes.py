"""create discussion room mutes

Revision ID: c5d6e7f8a9b0
Revises: b3c4d5e6f7a8
Create Date: 2026-07-25 16:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_room_mutes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column("muted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_room_mutes_user_room",
        ),
    )
    op.create_index(
        op.f("ix_discussion_room_mutes_id"),
        "discussion_room_mutes",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_mutes_user_id"),
        "discussion_room_mutes",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_mutes_room_id"),
        "discussion_room_mutes",
        ["room_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_room_mutes_room_id"),
        table_name="discussion_room_mutes",
    )
    op.drop_index(
        op.f("ix_discussion_room_mutes_user_id"),
        table_name="discussion_room_mutes",
    )
    op.drop_index(
        op.f("ix_discussion_room_mutes_id"),
        table_name="discussion_room_mutes",
    )
    op.drop_table("discussion_room_mutes")
