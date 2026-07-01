"""add event rsvp status

Revision ID: h1a2b3c4d5e6
Revises: g9h3b4c5d6e7
Create Date: 2026-06-29 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "g9h3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

rsvp_status_enum = sa.Enum("going", "maybe", "not_going", name="rsvpstatus")


def upgrade() -> None:
    rsvp_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "event_rsvps",
        sa.Column("status", rsvp_status_enum, nullable=True),
    )
    op.execute("UPDATE event_rsvps SET status = 'going' WHERE status IS NULL")
    op.alter_column("event_rsvps", "status", nullable=False)
    op.add_column(
        "event_rsvps",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE event_rsvps SET updated_at = created_at WHERE updated_at IS NULL",
    )
    op.alter_column("event_rsvps", "updated_at", nullable=False)


def downgrade() -> None:
    op.drop_column("event_rsvps", "updated_at")
    op.drop_column("event_rsvps", "status")
    rsvp_status_enum.drop(op.get_bind(), checkfirst=True)
