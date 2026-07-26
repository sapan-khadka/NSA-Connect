"""create event suggestion comments for idea discussion

Revision ID: g9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-07-26 12:50:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g9b0c1d2e3f4"
down_revision: Union[str, Sequence[str], None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_suggestion_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["suggestion_id"],
            ["event_suggestions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["event_suggestion_comments.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_id"),
        "event_suggestion_comments",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_suggestion_id"),
        "event_suggestion_comments",
        ["suggestion_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_author_id"),
        "event_suggestion_comments",
        ["author_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_parent_id"),
        "event_suggestion_comments",
        ["parent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_created_at"),
        "event_suggestion_comments",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_deleted_at"),
        "event_suggestion_comments",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_suggestion_comments_deleted_at"),
        table_name="event_suggestion_comments",
    )
    op.drop_index(
        op.f("ix_event_suggestion_comments_created_at"),
        table_name="event_suggestion_comments",
    )
    op.drop_index(
        op.f("ix_event_suggestion_comments_parent_id"),
        table_name="event_suggestion_comments",
    )
    op.drop_index(
        op.f("ix_event_suggestion_comments_author_id"),
        table_name="event_suggestion_comments",
    )
    op.drop_index(
        op.f("ix_event_suggestion_comments_suggestion_id"),
        table_name="event_suggestion_comments",
    )
    op.drop_index(
        op.f("ix_event_suggestion_comments_id"),
        table_name="event_suggestion_comments",
    )
    op.drop_table("event_suggestion_comments")
