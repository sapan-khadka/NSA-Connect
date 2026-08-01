"""add event media kind and duration

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2026-07-29 18:40:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s3t4u5v6w7x8"
down_revision: Union[str, Sequence[str], None] = "r2s3t4u5v6w7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_photos",
        sa.Column(
            "media_kind",
            sa.String(length=16),
            nullable=False,
            server_default="photo",
        ),
    )
    op.add_column(
        "event_photos",
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("event_photos", "duration_seconds")
    op.drop_column("event_photos", "media_kind")
