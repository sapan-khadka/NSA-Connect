"""create event_rsvps table

Revision ID: e1a4c9f82b07
Revises: d8f3a2b91e04
Create Date: 2026-06-25 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1a4c9f82b07"
down_revision: Union[str, Sequence[str], None] = "d8f3a2b91e04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_rsvps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "member_id", name="uq_event_rsvps_event_member"),
    )
    op.create_index(op.f("ix_event_rsvps_id"), "event_rsvps", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_rsvps_id"), table_name="event_rsvps")
    op.drop_table("event_rsvps")
