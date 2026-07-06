"""create event volunteer signups table

Revision ID: v5w6x7y8z9a1
Revises: u4v5w6x7y8z0
Create Date: 2026-07-06 01:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v5w6x7y8z9a1"
down_revision: Union[str, Sequence[str], None] = "u4v5w6x7y8z0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_volunteer_signups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_event_volunteer_signups_event_member",
        ),
    )
    op.create_index(
        op.f("ix_event_volunteer_signups_event_id"),
        "event_volunteer_signups",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_volunteer_signups_id"),
        "event_volunteer_signups",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_volunteer_signups_member_id"),
        "event_volunteer_signups",
        ["member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_volunteer_signups_member_id"),
        table_name="event_volunteer_signups",
    )
    op.drop_index(
        op.f("ix_event_volunteer_signups_id"),
        table_name="event_volunteer_signups",
    )
    op.drop_index(
        op.f("ix_event_volunteer_signups_event_id"),
        table_name="event_volunteer_signups",
    )
    op.drop_table("event_volunteer_signups")
