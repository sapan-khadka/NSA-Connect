"""add member notification preference columns

Revision ID: o8p9q0r1s2t4
Revises: n7o8p9q0r1s3
Create Date: 2026-07-05 00:15:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o8p9q0r1s2t4"
down_revision: Union[str, Sequence[str], None] = "n7o8p9q0r1s3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "notify_event_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "members",
        sa.Column(
            "notify_rsvp_nudges",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "members",
        sa.Column(
            "notify_task_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("members", "notify_task_reminders")
    op.drop_column("members", "notify_rsvp_nudges")
    op.drop_column("members", "notify_event_reminders")
