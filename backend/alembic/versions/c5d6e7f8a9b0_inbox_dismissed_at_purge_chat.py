"""Add inbox dismissed_at; purge discussion_message inbox rows

Revision ID: c5d6e7f8a9b0
Revises: b1c2d3e4f5b6
Create Date: 2026-09-15 02:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inbox_notifications",
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_inbox_notifications_member_dismissed",
        "inbox_notifications",
        ["member_id", "dismissed_at"],
        unique=False,
    )
    op.execute(
        sa.text(
            "DELETE FROM inbox_notifications WHERE type = 'discussion_message'"
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_inbox_notifications_member_dismissed",
        table_name="inbox_notifications",
    )
    op.drop_column("inbox_notifications", "dismissed_at")
