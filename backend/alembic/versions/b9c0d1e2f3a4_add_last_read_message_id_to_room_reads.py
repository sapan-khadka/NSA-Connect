"""add last_read_message_id to discussion_room_reads

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-07-11 21:15:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "discussion_room_reads",
        sa.Column("last_read_message_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_discussion_room_reads_last_read_message_id",
        "discussion_room_reads",
        "discussion_messages",
        ["last_read_message_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_discussion_room_reads_last_read_message_id"),
        "discussion_room_reads",
        ["last_read_message_id"],
        unique=False,
    )

    # Backfill from legacy per-message watermark table when present.
    op.execute(
        sa.text(
            """
            UPDATE discussion_room_reads AS reads
            SET last_read_message_id = state.last_read_message_id
            FROM discussion_read_state AS state
            WHERE reads.user_id = state.user_id
              AND reads.room_id = state.room_id
              AND reads.last_read_at IS NOT NULL
              AND reads.last_read_message_id IS NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO discussion_room_reads (
                user_id, room_id, last_read_at, last_read_message_id
            )
            SELECT
                state.user_id,
                state.room_id,
                COALESCE(state.updated_at, now()),
                state.last_read_message_id
            FROM discussion_read_state AS state
            WHERE NOT EXISTS (
                SELECT 1
                FROM discussion_room_reads AS reads
                WHERE reads.user_id = state.user_id
                  AND reads.room_id = state.room_id
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_room_reads_last_read_message_id"),
        table_name="discussion_room_reads",
    )
    op.drop_constraint(
        "fk_discussion_room_reads_last_read_message_id",
        "discussion_room_reads",
        type_="foreignkey",
    )
    op.drop_column("discussion_room_reads", "last_read_message_id")
