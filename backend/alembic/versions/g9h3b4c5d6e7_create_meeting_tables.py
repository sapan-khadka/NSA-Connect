"""create meeting records and attendance tables

Revision ID: g9h3b4c5d6e7
Revises: d4e5f6a7b8c9
Create Date: 2026-06-29 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g9h3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meeting_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("raw_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("key_decisions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("action_items", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index(op.f("ix_meeting_records_id"), "meeting_records", ["id"], unique=False)

    op.create_table(
        "meeting_attendance",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "present",
                "absent",
                "excused",
                name="meetingattendancestatus",
            ),
            nullable=False,
        ),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_meeting_attendance_event_member",
        ),
    )
    op.create_index(
        op.f("ix_meeting_attendance_id"),
        "meeting_attendance",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_meeting_attendance_id"), table_name="meeting_attendance")
    op.drop_table("meeting_attendance")
    op.drop_index(op.f("ix_meeting_records_id"), table_name="meeting_records")
    op.drop_table("meeting_records")
    op.execute("DROP TYPE IF EXISTS meetingattendancestatus")
