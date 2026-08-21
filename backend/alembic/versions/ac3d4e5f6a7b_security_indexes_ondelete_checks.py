"""add RSVP/attendance indexes, FK ondelete rules, money check constraints

Revision ID: ac3d4e5f6a7b
Revises: ab2c3d4e5f6a
Create Date: 2026-08-19 10:15:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "ac3d4e5f6a7b"
down_revision: Union[str, Sequence[str], None] = "ab2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- indexes on heavily-queried junction tables ---
    op.create_index("ix_event_rsvps_event_id", "event_rsvps", ["event_id"])
    op.create_index("ix_event_rsvps_member_id", "event_rsvps", ["member_id"])
    op.create_index("ix_meeting_attendance_event_id", "meeting_attendance", ["event_id"])
    op.create_index("ix_meeting_attendance_member_id", "meeting_attendance", ["member_id"])
    op.create_index("ix_announcements_created_at", "announcements", ["created_at"])

    # --- ondelete on foreign keys ---
    # event_rsvps
    op.drop_constraint("event_rsvps_event_id_fkey", "event_rsvps", type_="foreignkey")
    op.create_foreign_key(
        "event_rsvps_event_id_fkey", "event_rsvps", "events",
        ["event_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_constraint("event_rsvps_member_id_fkey", "event_rsvps", type_="foreignkey")
    op.create_foreign_key(
        "event_rsvps_member_id_fkey", "event_rsvps", "users",
        ["member_id"], ["id"], ondelete="CASCADE",
    )

    # meeting_attendance
    op.drop_constraint("meeting_attendance_event_id_fkey", "meeting_attendance", type_="foreignkey")
    op.create_foreign_key(
        "meeting_attendance_event_id_fkey", "meeting_attendance", "events",
        ["event_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_constraint("meeting_attendance_member_id_fkey", "meeting_attendance", type_="foreignkey")
    op.create_foreign_key(
        "meeting_attendance_member_id_fkey", "meeting_attendance", "users",
        ["member_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_constraint("meeting_attendance_updated_by_id_fkey", "meeting_attendance", type_="foreignkey")
    op.create_foreign_key(
        "meeting_attendance_updated_by_id_fkey", "meeting_attendance", "users",
        ["updated_by_id"], ["id"], ondelete="SET NULL",
    )

    # meeting_records
    op.drop_constraint("meeting_records_updated_by_id_fkey", "meeting_records", type_="foreignkey")
    op.create_foreign_key(
        "meeting_records_updated_by_id_fkey", "meeting_records", "users",
        ["updated_by_id"], ["id"], ondelete="SET NULL",
    )

    # event_tasks
    op.drop_constraint("event_tasks_assignee_id_fkey", "event_tasks", type_="foreignkey")
    op.create_foreign_key(
        "event_tasks_assignee_id_fkey", "event_tasks", "users",
        ["assignee_id"], ["id"], ondelete="SET NULL",
    )
    op.drop_constraint("event_tasks_created_by_id_fkey", "event_tasks", type_="foreignkey")
    op.create_foreign_key(
        "event_tasks_created_by_id_fkey", "event_tasks", "users",
        ["created_by_id"], ["id"], ondelete="SET NULL",
    )

    # events.created_by_id
    op.drop_constraint("events_created_by_id_fkey", "events", type_="foreignkey")
    op.create_foreign_key(
        "events_created_by_id_fkey", "events", "users",
        ["created_by_id"], ["id"], ondelete="CASCADE",
    )

    # volunteer_signups
    op.drop_constraint("volunteer_signups_slot_id_fkey", "volunteer_signups", type_="foreignkey")
    op.create_foreign_key(
        "volunteer_signups_slot_id_fkey", "volunteer_signups", "volunteer_slots",
        ["slot_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_constraint("volunteer_signups_member_id_fkey", "volunteer_signups", type_="foreignkey")
    op.create_foreign_key(
        "volunteer_signups_member_id_fkey", "volunteer_signups", "users",
        ["member_id"], ["id"], ondelete="CASCADE",
    )

    # --- check constraints on money columns ---
    op.create_check_constraint(
        "ck_finance_entries_amount_non_negative",
        "finance_entries",
        "amount >= 0",
    )
    op.create_check_constraint(
        "ck_member_dues_amount_owed_non_negative",
        "member_dues",
        "amount_owed >= 0",
    )
    op.create_check_constraint(
        "ck_member_dues_amount_paid_non_negative",
        "member_dues",
        "amount_paid >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_member_dues_amount_paid_non_negative", "member_dues", type_="check")
    op.drop_constraint("ck_member_dues_amount_owed_non_negative", "member_dues", type_="check")
    op.drop_constraint("ck_finance_entries_amount_non_negative", "finance_entries", type_="check")

    # revert volunteer_signups
    op.drop_constraint("volunteer_signups_member_id_fkey", "volunteer_signups", type_="foreignkey")
    op.create_foreign_key("volunteer_signups_member_id_fkey", "volunteer_signups", "users", ["member_id"], ["id"])
    op.drop_constraint("volunteer_signups_slot_id_fkey", "volunteer_signups", type_="foreignkey")
    op.create_foreign_key("volunteer_signups_slot_id_fkey", "volunteer_signups", "volunteer_slots", ["slot_id"], ["id"])

    # revert events
    op.drop_constraint("events_created_by_id_fkey", "events", type_="foreignkey")
    op.create_foreign_key("events_created_by_id_fkey", "events", "users", ["created_by_id"], ["id"])

    # revert event_tasks
    op.drop_constraint("event_tasks_created_by_id_fkey", "event_tasks", type_="foreignkey")
    op.create_foreign_key("event_tasks_created_by_id_fkey", "event_tasks", "users", ["created_by_id"], ["id"])
    op.drop_constraint("event_tasks_assignee_id_fkey", "event_tasks", type_="foreignkey")
    op.create_foreign_key("event_tasks_assignee_id_fkey", "event_tasks", "users", ["assignee_id"], ["id"])

    # revert meeting_records
    op.drop_constraint("meeting_records_updated_by_id_fkey", "meeting_records", type_="foreignkey")
    op.create_foreign_key("meeting_records_updated_by_id_fkey", "meeting_records", "users", ["updated_by_id"], ["id"])

    # revert meeting_attendance
    op.drop_constraint("meeting_attendance_updated_by_id_fkey", "meeting_attendance", type_="foreignkey")
    op.create_foreign_key("meeting_attendance_updated_by_id_fkey", "meeting_attendance", "users", ["updated_by_id"], ["id"])
    op.drop_constraint("meeting_attendance_member_id_fkey", "meeting_attendance", type_="foreignkey")
    op.create_foreign_key("meeting_attendance_member_id_fkey", "meeting_attendance", "users", ["member_id"], ["id"])
    op.drop_constraint("meeting_attendance_event_id_fkey", "meeting_attendance", type_="foreignkey")
    op.create_foreign_key("meeting_attendance_event_id_fkey", "meeting_attendance", "events", ["event_id"], ["id"])

    # revert event_rsvps
    op.drop_constraint("event_rsvps_member_id_fkey", "event_rsvps", type_="foreignkey")
    op.create_foreign_key("event_rsvps_member_id_fkey", "event_rsvps", "users", ["member_id"], ["id"])
    op.drop_constraint("event_rsvps_event_id_fkey", "event_rsvps", type_="foreignkey")
    op.create_foreign_key("event_rsvps_event_id_fkey", "event_rsvps", "events", ["event_id"], ["id"])

    op.drop_index("ix_announcements_created_at", "announcements")
    op.drop_index("ix_meeting_attendance_member_id", "meeting_attendance")
    op.drop_index("ix_meeting_attendance_event_id", "meeting_attendance")
    op.drop_index("ix_event_rsvps_member_id", "event_rsvps")
    op.drop_index("ix_event_rsvps_event_id", "event_rsvps")
