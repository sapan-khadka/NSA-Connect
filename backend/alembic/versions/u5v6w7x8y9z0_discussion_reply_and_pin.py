"""discussion message replies and thread pins

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-07-30 09:40:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u5v6w7x8y9z0"
down_revision: Union[str, Sequence[str], None] = "t4u5v6w7x8y9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "discussion_messages",
        sa.Column("reply_to_message_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_discussion_messages_reply_to_message_id",
        "discussion_messages",
        "discussion_messages",
        ["reply_to_message_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_discussion_messages_reply_to_message_id"),
        "discussion_messages",
        ["reply_to_message_id"],
        unique=False,
    )

    op.create_table(
        "discussion_thread_pins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_key", sa.String(length=64), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("pinned_by_id", sa.Integer(), nullable=False),
        sa.Column(
            "pinned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["discussion_messages.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["pinned_by_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_key", name="uq_discussion_thread_pins_room_key"),
    )
    op.create_index(
        op.f("ix_discussion_thread_pins_room_key"),
        "discussion_thread_pins",
        ["room_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_thread_pins_message_id"),
        "discussion_thread_pins",
        ["message_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_thread_pins_message_id"),
        table_name="discussion_thread_pins",
    )
    op.drop_index(
        op.f("ix_discussion_thread_pins_room_key"),
        table_name="discussion_thread_pins",
    )
    op.drop_table("discussion_thread_pins")
    op.drop_index(
        op.f("ix_discussion_messages_reply_to_message_id"),
        table_name="discussion_messages",
    )
    op.drop_constraint(
        "fk_discussion_messages_reply_to_message_id",
        "discussion_messages",
        type_="foreignkey",
    )
    op.drop_column("discussion_messages", "reply_to_message_id")
