"""add board review note to event suggestions

Revision ID: h0c1d2e3f4a5
Revises: g9b0c1d2e3f4
Create Date: 2026-07-26 12:55:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h0c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "g9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column("board_note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("event_suggestions", "board_note")
