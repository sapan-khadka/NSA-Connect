"""create notification_sent_logs table

Revision ID: p9q0r1s2t3u5
Revises: o8p9q0r1s2t4
Create Date: 2026-07-05 01:45:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "p9q0r1s2t3u5"
down_revision: Union[str, Sequence[str], None] = "o8p9q0r1s2t4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

notification_type = postgresql.ENUM(
    "event_reminder",
    "rsvp_nudge",
    "task_due_reminder",
    "task_assigned",
    name="notificationtype",
    create_type=False,
)


def upgrade() -> None:
    notification_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notification_sent_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("notification_type", notification_type, nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=True),
        sa.Column("event_task_id", sa.Integer(), nullable=True),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["event_task_id"], ["event_tasks.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_notification_sent_logs_id"),
        "notification_sent_logs",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_sent_logs_member_id"),
        "notification_sent_logs",
        ["member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_sent_logs_event_id"),
        "notification_sent_logs",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_sent_logs_event_task_id"),
        "notification_sent_logs",
        ["event_task_id"],
        unique=False,
    )

    op.execute(
        """
        CREATE UNIQUE INDEX uq_notification_sent_event
        ON notification_sent_logs (member_id, notification_type, event_id)
        WHERE event_id IS NOT NULL
          AND notification_type IN ('event_reminder', 'rsvp_nudge')
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_notification_sent_task_due
        ON notification_sent_logs (member_id, notification_type, event_task_id)
        WHERE event_task_id IS NOT NULL
          AND notification_type = 'task_due_reminder'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_notification_sent_task_due")
    op.execute("DROP INDEX IF EXISTS uq_notification_sent_event")
    op.drop_index(
        op.f("ix_notification_sent_logs_event_task_id"),
        table_name="notification_sent_logs",
    )
    op.drop_index(
        op.f("ix_notification_sent_logs_event_id"),
        table_name="notification_sent_logs",
    )
    op.drop_index(
        op.f("ix_notification_sent_logs_member_id"),
        table_name="notification_sent_logs",
    )
    op.drop_index(op.f("ix_notification_sent_logs_id"), table_name="notification_sent_logs")
    op.drop_table("notification_sent_logs")
    notification_type.drop(op.get_bind(), checkfirst=True)
