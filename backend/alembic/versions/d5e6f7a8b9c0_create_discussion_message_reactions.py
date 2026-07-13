"""create discussion_message_reactions table

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-11 20:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_message_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
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
            ["user_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "message_id",
            "user_id",
            "emoji",
            name="uq_discussion_message_reactions_message_user_emoji",
        ),
    )
    op.create_index(
        op.f("ix_discussion_message_reactions_id"),
        "discussion_message_reactions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_message_reactions_message_id"),
        "discussion_message_reactions",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_message_reactions_user_id"),
        "discussion_message_reactions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_message_reactions_user_id"),
        table_name="discussion_message_reactions",
    )
    op.drop_index(
        op.f("ix_discussion_message_reactions_message_id"),
        table_name="discussion_message_reactions",
    )
    op.drop_index(
        op.f("ix_discussion_message_reactions_id"),
        table_name="discussion_message_reactions",
    )
    op.drop_table("discussion_message_reactions")
