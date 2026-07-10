"""create discussion_messages table

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-07-10 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["author_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_discussion_messages_id"),
        "discussion_messages",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_messages_author_id"),
        "discussion_messages",
        ["author_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_messages_event_id"),
        "discussion_messages",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_messages_created_at"),
        "discussion_messages",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_discussion_messages_created_at"), table_name="discussion_messages")
    op.drop_index(op.f("ix_discussion_messages_event_id"), table_name="discussion_messages")
    op.drop_index(op.f("ix_discussion_messages_author_id"), table_name="discussion_messages")
    op.drop_index(op.f("ix_discussion_messages_id"), table_name="discussion_messages")
    op.drop_table("discussion_messages")
