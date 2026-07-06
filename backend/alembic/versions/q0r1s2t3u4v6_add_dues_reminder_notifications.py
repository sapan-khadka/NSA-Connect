"""add dues reminder notification support

Revision ID: q0r1s2t3u4v6
Revises: p9q0r1s2t3u5
Create Date: 2026-07-05 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "q0r1s2t3u4v6"
down_revision: Union[str, Sequence[str], None] = "p9q0r1s2t3u5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    member_columns = {column["name"] for column in inspector.get_columns("members")}
    log_columns = {
        column["name"] for column in inspector.get_columns("notification_sent_logs")
    }
    log_indexes = {
        index["name"] for index in inspector.get_indexes("notification_sent_logs")
    }

    if "notify_dues_reminders" not in member_columns:
        op.add_column(
            "members",
            sa.Column(
                "notify_dues_reminders",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )

    if "semester" not in log_columns:
        op.add_column(
            "notification_sent_logs",
            sa.Column("semester", sa.String(length=16), nullable=True),
        )

    if "ix_notification_sent_logs_semester" not in log_indexes:
        op.create_index(
            op.f("ix_notification_sent_logs_semester"),
            "notification_sent_logs",
            ["semester"],
            unique=False,
        )

    # PostgreSQL requires new enum values to be committed before use in indexes.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'dues_reminder'",
        )

    if "uq_notification_sent_dues" not in log_indexes:
        with op.get_context().autocommit_block():
            op.execute(
                """
                CREATE UNIQUE INDEX uq_notification_sent_dues
                ON notification_sent_logs (member_id, notification_type, semester)
                WHERE semester IS NOT NULL
                  AND notification_type = 'dues_reminder'
                """
            )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_notification_sent_dues")
    op.drop_index(
        op.f("ix_notification_sent_logs_semester"),
        table_name="notification_sent_logs",
    )
    op.drop_column("notification_sent_logs", "semester")
    op.drop_column("members", "notify_dues_reminders")
