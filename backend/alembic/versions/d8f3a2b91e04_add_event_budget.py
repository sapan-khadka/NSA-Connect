"""add budget column to events

Revision ID: d8f3a2b91e04
Revises: c4d8e12f6a90
Create Date: 2026-06-24 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d8f3a2b91e04"
down_revision: Union[str, Sequence[str], None] = "c4d8e12f6a90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("budget", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
    )
    op.alter_column("events", "budget", server_default=None)


def downgrade() -> None:
    op.drop_column("events", "budget")
