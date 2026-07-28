"""idea community feedback enable flags

Revision ID: n6i7j8k9l0m1
Revises: m5h6i7j8k9l0
Create Date: 2026-07-26 21:50:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n6i7j8k9l0m1"
down_revision: Union[str, Sequence[str], None] = "m5h6i7j8k9l0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column(
            "community_interest_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "event_suggestions",
        sa.Column(
            "community_discussion_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("event_suggestions", "community_discussion_enabled")
    op.drop_column("event_suggestions", "community_interest_enabled")
