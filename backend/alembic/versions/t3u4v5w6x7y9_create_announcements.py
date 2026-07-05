"""create announcements and announcement notification preference

Revision ID: t3u4v5w6x7y9
Revises: s2t3u4v5w6x8
Create Date: 2026-07-05 23:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "t3u4v5w6x7y9"
down_revision: Union[str, Sequence[str], None] = "s2t3u4v5w6x8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

announcement_category = postgresql.ENUM(
    "general",
    "urgent",
    "event_related",
    name="announcementcategory",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE announcementcategory AS ENUM ('general', 'urgent', 'event_related');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("category", announcement_category, nullable=False, server_default="general"),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_announcements_id"), "announcements", ["id"], unique=False)
    op.create_index(
        op.f("ix_announcements_author_id"),
        "announcements",
        ["author_id"],
        unique=False,
    )

    op.add_column(
        "members",
        sa.Column(
            "notify_announcements",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    op.add_column(
        "notification_sent_logs",
        sa.Column("announcement_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_notification_sent_logs_announcement_id"),
        "notification_sent_logs",
        ["announcement_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_notification_sent_logs_announcement_id",
        "notification_sent_logs",
        "announcements",
        ["announcement_id"],
        ["id"],
        ondelete="SET NULL",
    )

    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'announcement'",
        )


def downgrade() -> None:
    op.drop_constraint(
        "fk_notification_sent_logs_announcement_id",
        "notification_sent_logs",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_notification_sent_logs_announcement_id"),
        table_name="notification_sent_logs",
    )
    op.drop_column("notification_sent_logs", "announcement_id")
    op.drop_column("members", "notify_announcements")
    op.drop_index(op.f("ix_announcements_author_id"), table_name="announcements")
    op.drop_index(op.f("ix_announcements_id"), table_name="announcements")
    op.drop_table("announcements")
    announcement_category.drop(op.get_bind(), checkfirst=True)
