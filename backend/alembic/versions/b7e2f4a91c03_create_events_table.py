"""create events table

Revision ID: b7e2f4a91c03
Revises: a3c8d91e4f20
Create Date: 2026-06-24 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7e2f4a91c03"
down_revision: Union[str, Sequence[str], None] = "a3c8d91e4f20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

eventtype = postgresql.ENUM(
    "cultural",
    "meeting",
    "fundraiser",
    "social",
    "service",
    name="eventtype",
    create_type=False,
)


def upgrade() -> None:
    eventtype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("event_type", eventtype, nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_events_id"), "events", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_events_id"), table_name="events")
    op.drop_table("events")
    eventtype.drop(op.get_bind(), checkfirst=True)
