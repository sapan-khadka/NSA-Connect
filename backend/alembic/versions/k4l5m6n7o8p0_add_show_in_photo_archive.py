"""add show_in_photo_archive to events

Revision ID: k4l5m6n7o8p0
Revises: j3k4l5m6n8o9
Create Date: 2026-06-29 20:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k4l5m6n7o8p0"
down_revision: Union[str, None] = "j3k4l5m6n8o9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "show_in_photo_archive",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )
    op.execute(
        "UPDATE events SET show_in_photo_archive = false WHERE event_type = 'meeting'",
    )
    op.alter_column("events", "show_in_photo_archive", server_default=None)


def downgrade() -> None:
    op.drop_column("events", "show_in_photo_archive")
