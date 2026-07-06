"""create event suggestions table

Revision ID: u4v5w6x7y8z0
Revises: t3u4v5w6x7y9
Create Date: 2026-07-05 23:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "u4v5w6x7y8z0"
down_revision: Union[str, Sequence[str], None] = "t3u4v5w6x7y9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

suggestion_status = postgresql.ENUM(
    "submitted",
    "noted",
    name="eventsuggestionstatus",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE eventsuggestionstatus AS ENUM ('submitted', 'noted');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "event_suggestions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("preferred_timing", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            suggestion_status,
            nullable=False,
            server_default="submitted",
        ),
        sa.Column("suggested_by_id", sa.Integer(), nullable=False),
        sa.Column("noted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("noted_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["suggested_by_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["noted_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_event_suggestions_id"),
        "event_suggestions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestions_suggested_by_id"),
        "event_suggestions",
        ["suggested_by_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_suggestions_noted_by_id"),
        "event_suggestions",
        ["noted_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_suggestions_noted_by_id"),
        table_name="event_suggestions",
    )
    op.drop_index(
        op.f("ix_event_suggestions_suggested_by_id"),
        table_name="event_suggestions",
    )
    op.drop_index(op.f("ix_event_suggestions_id"), table_name="event_suggestions")
    op.drop_table("event_suggestions")
    suggestion_status.drop(op.get_bind(), checkfirst=True)
