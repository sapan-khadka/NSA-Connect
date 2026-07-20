"""create inbox_notifications table

Revision ID: g5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-07-19 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g5b6c7d8e9f0"
down_revision: Union[str, Sequence[str], None] = "f4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inbox_notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("href", sa.String(length=500), nullable=True),
        sa.Column("dedupe_key", sa.String(length=255), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "member_id",
            "dedupe_key",
            name="uq_inbox_notifications_member_dedupe",
        ),
    )
    op.create_index(
        op.f("ix_inbox_notifications_id"),
        "inbox_notifications",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inbox_notifications_member_id"),
        "inbox_notifications",
        ["member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inbox_notifications_type"),
        "inbox_notifications",
        ["type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inbox_notifications_created_at"),
        "inbox_notifications",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_inbox_notifications_member_created",
        "inbox_notifications",
        ["member_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_inbox_notifications_member_read",
        "inbox_notifications",
        ["member_id", "read_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_inbox_notifications_member_read",
        table_name="inbox_notifications",
    )
    op.drop_index(
        "ix_inbox_notifications_member_created",
        table_name="inbox_notifications",
    )
    op.drop_index(
        op.f("ix_inbox_notifications_created_at"),
        table_name="inbox_notifications",
    )
    op.drop_index(
        op.f("ix_inbox_notifications_type"),
        table_name="inbox_notifications",
    )
    op.drop_index(
        op.f("ix_inbox_notifications_member_id"),
        table_name="inbox_notifications",
    )
    op.drop_index(
        op.f("ix_inbox_notifications_id"),
        table_name="inbox_notifications",
    )
    op.drop_table("inbox_notifications")
