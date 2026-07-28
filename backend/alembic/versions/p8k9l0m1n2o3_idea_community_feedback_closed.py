"""idea community feedback closed_at

Revision ID: p8k9l0m1n2o3
Revises: o7j8k9l0m1n2
Create Date: 2026-07-27 14:35:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "p8k9l0m1n2o3"
down_revision: Union[str, Sequence[str], None] = "o7j8k9l0m1n2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column(
            "community_feedback_closed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("event_suggestions", "community_feedback_closed_at")
