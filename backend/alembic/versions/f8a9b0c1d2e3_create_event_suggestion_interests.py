"""create event suggestion interest votes

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-07-26 12:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

interest_vote = postgresql.ENUM(
    "interested",
    "maybe",
    "not_interested",
    name="eventsuggestioninterestvote",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE eventsuggestioninterestvote AS ENUM (
                'interested',
                'maybe',
                'not_interested'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "event_suggestion_interests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("vote", interest_vote, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
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
            name="uq_event_suggestion_interests_suggestion_member",
        ),
    )
    op.create_index(
        op.f("ix_event_suggestion_interests_id"),
        "event_suggestion_interests",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_interests_suggestion_id"),
        "event_suggestion_interests",
        ["suggestion_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestion_interests_member_id"),
        "event_suggestion_interests",
        ["member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_suggestion_interests_member_id"),
        table_name="event_suggestion_interests",
    )
    op.drop_index(
        op.f("ix_event_suggestion_interests_suggestion_id"),
        table_name="event_suggestion_interests",
    )
    op.drop_index(
        op.f("ix_event_suggestion_interests_id"),
        table_name="event_suggestion_interests",
    )
    op.drop_table("event_suggestion_interests")
    interest_vote.drop(op.get_bind(), checkfirst=True)
