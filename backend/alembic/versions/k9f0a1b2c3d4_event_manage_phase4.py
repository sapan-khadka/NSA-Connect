"""Event manage Phase 4: announcement event/audience, event capacity

Revision ID: k9f0a1b2c3d4
Revises: j8e9f0a1b2c3
Create Date: 2026-07-21 11:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k9f0a1b2c3d4"
down_revision: Union[str, Sequence[str], None] = "j8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "announcements",
        sa.Column("event_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_announcements_event_id",
        "announcements",
        ["event_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_announcements_event_id",
        "announcements",
        "events",
        ["event_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "announcements",
        sa.Column(
            "audience",
            sa.String(length=32),
            nullable=False,
            server_default="all_approved",
        ),
    )

    op.add_column(
        "events",
        sa.Column("capacity", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_events_capacity_positive",
        "events",
        "capacity IS NULL OR capacity > 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_events_capacity_positive", "events", type_="check")
    op.drop_column("events", "capacity")

    op.drop_column("announcements", "audience")
    op.drop_constraint("fk_announcements_event_id", "announcements", type_="foreignkey")
    op.drop_index("ix_announcements_event_id", table_name="announcements")
    op.drop_column("announcements", "event_id")
