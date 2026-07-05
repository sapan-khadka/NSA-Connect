"""add event check-in token and attendance records

Revision ID: r1s2t3u4v5w7
Revises: q0r1s2t3u4v6
Create Date: 2026-07-05 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "r1s2t3u4v5w7"
down_revision: Union[str, Sequence[str], None] = "q0r1s2t3u4v6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("checkin_token", sa.String(length=64), nullable=True),
    )

    op.create_table(
        "event_check_ins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "member_id", name="uq_event_check_ins_event_member"),
    )
    op.create_index(
        op.f("ix_event_check_ins_id"),
        "event_check_ins",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_check_ins_event_id"),
        "event_check_ins",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_check_ins_member_id"),
        "event_check_ins",
        ["member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_event_check_ins_member_id"), table_name="event_check_ins")
    op.drop_index(op.f("ix_event_check_ins_event_id"), table_name="event_check_ins")
    op.drop_index(op.f("ix_event_check_ins_id"), table_name="event_check_ins")
    op.drop_table("event_check_ins")
    op.drop_column("events", "checkin_token")
