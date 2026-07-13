"""create discussion_read_state table

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-11 20:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_read_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column("last_read_message_id", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["last_read_message_id"],
            ["discussion_messages.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_read_state_user_room",
        ),
    )
    op.create_index(
        op.f("ix_discussion_read_state_id"),
        "discussion_read_state",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_read_state_user_id"),
        "discussion_read_state",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_read_state_room_id"),
        "discussion_read_state",
        ["room_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_read_state_last_read_message_id"),
        "discussion_read_state",
        ["last_read_message_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_read_state_last_read_message_id"),
        table_name="discussion_read_state",
    )
    op.drop_index(
        op.f("ix_discussion_read_state_room_id"),
        table_name="discussion_read_state",
    )
    op.drop_index(
        op.f("ix_discussion_read_state_user_id"),
        table_name="discussion_read_state",
    )
    op.drop_index(
        op.f("ix_discussion_read_state_id"),
        table_name="discussion_read_state",
    )
    op.drop_table("discussion_read_state")
