"""add idea view tracking and simple polls

Revision ID: j2e3f4a5b6c7
Revises: i1d2e3f4a5b6
Create Date: 2026-07-26 13:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j2e3f4a5b6c7"
down_revision: Union[str, Sequence[str], None] = "i1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column(
            "view_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.create_table(
        "event_suggestion_views",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["suggestion_id"],
            ["event_suggestions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "suggestion_id",
            "member_id",
            name="uq_event_suggestion_views_suggestion_member",
        ),
    )
    op.create_index(
        op.f("ix_event_suggestion_views_suggestion_id"),
        "event_suggestion_views",
        ["suggestion_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_views_member_id"),
        "event_suggestion_views",
        ["member_id"],
        unique=False,
    )

    op.create_table(
        "event_suggestion_polls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("question", sa.String(length=255), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["suggestion_id"],
            ["event_suggestions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "suggestion_id",
            name="uq_event_suggestion_polls_suggestion_id",
        ),
    )
    op.create_index(
        op.f("ix_event_suggestion_polls_suggestion_id"),
        "event_suggestion_polls",
        ["suggestion_id"],
        unique=False,
    )

    op.create_table(
        "event_suggestion_poll_options",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("poll_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["poll_id"],
            ["event_suggestion_polls.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_event_suggestion_poll_options_poll_id"),
        "event_suggestion_poll_options",
        ["poll_id"],
        unique=False,
    )

    op.create_table(
        "event_suggestion_poll_votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("poll_id", sa.Integer(), nullable=False),
        sa.Column("option_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["poll_id"],
            ["event_suggestion_polls.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["option_id"],
            ["event_suggestion_poll_options.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "poll_id",
            "member_id",
            name="uq_event_suggestion_poll_votes_poll_member",
        ),
    )
    op.create_index(
        op.f("ix_event_suggestion_poll_votes_poll_id"),
        "event_suggestion_poll_votes",
        ["poll_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_poll_votes_member_id"),
        "event_suggestion_poll_votes",
        ["member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_suggestion_poll_votes_member_id"),
        table_name="event_suggestion_poll_votes",
    )
    op.drop_index(
        op.f("ix_event_suggestion_poll_votes_poll_id"),
        table_name="event_suggestion_poll_votes",
    )
    op.drop_table("event_suggestion_poll_votes")
    op.drop_index(
        op.f("ix_event_suggestion_poll_options_poll_id"),
        table_name="event_suggestion_poll_options",
    )
    op.drop_table("event_suggestion_poll_options")
    op.drop_index(
        op.f("ix_event_suggestion_polls_suggestion_id"),
        table_name="event_suggestion_polls",
    )
    op.drop_table("event_suggestion_polls")
    op.drop_index(
        op.f("ix_event_suggestion_views_member_id"),
        table_name="event_suggestion_views",
    )
    op.drop_index(
        op.f("ix_event_suggestion_views_suggestion_id"),
        table_name="event_suggestion_views",
    )
    op.drop_table("event_suggestion_views")
    op.drop_column("event_suggestions", "view_count")
