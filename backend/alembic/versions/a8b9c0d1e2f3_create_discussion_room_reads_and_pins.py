"""create discussion room reads and pins tables

Revision ID: a8b9c0d1e2f3
Revises: e6f7a8b9c0d1
Create Date: 2026-07-11 21:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_room_reads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column(
            "last_read_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_room_reads_user_room",
        ),
    )
    op.create_index(
        op.f("ix_discussion_room_reads_id"),
        "discussion_room_reads",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_reads_user_id"),
        "discussion_room_reads",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_reads_room_id"),
        "discussion_room_reads",
        ["room_id"],
        unique=False,
    )

    op.create_table(
        "discussion_room_pins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column(
            "pinned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_room_pins_user_room",
        ),
    )
    op.create_index(
        op.f("ix_discussion_room_pins_id"),
        "discussion_room_pins",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_pins_user_id"),
        "discussion_room_pins",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_pins_room_id"),
        "discussion_room_pins",
        ["room_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_room_pins_room_id"),
        table_name="discussion_room_pins",
    )
    op.drop_index(
        op.f("ix_discussion_room_pins_user_id"),
        table_name="discussion_room_pins",
    )
    op.drop_index(
        op.f("ix_discussion_room_pins_id"),
        table_name="discussion_room_pins",
    )
    op.drop_table("discussion_room_pins")

    op.drop_index(
        op.f("ix_discussion_room_reads_room_id"),
        table_name="discussion_room_reads",
    )
    op.drop_index(
        op.f("ix_discussion_room_reads_user_id"),
        table_name="discussion_room_reads",
    )
    op.drop_index(
        op.f("ix_discussion_room_reads_id"),
        table_name="discussion_room_reads",
    )
    op.drop_table("discussion_room_reads")
