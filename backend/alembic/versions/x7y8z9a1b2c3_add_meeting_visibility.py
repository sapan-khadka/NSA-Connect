"""add meeting visibility to events

Revision ID: x7y8z9a1b2c3
Revises: w6x7y8z9a1b2
Create Date: 2026-07-06 03:15:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "x7y8z9a1b2c3"
down_revision: Union[str, Sequence[str], None] = "w6x7y8z9a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

meeting_visibility_enum = sa.Enum(
    "board_only",
    "public",
    name="meetingvisibility",
)


def upgrade() -> None:
    meeting_visibility_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "events",
        sa.Column("meeting_visibility", meeting_visibility_enum, nullable=True),
    )
    op.execute(
        "UPDATE events SET meeting_visibility = 'public' WHERE event_type = 'meeting'",
    )


def downgrade() -> None:
    op.drop_column("events", "meeting_visibility")
    meeting_visibility_enum.drop(op.get_bind(), checkfirst=True)
