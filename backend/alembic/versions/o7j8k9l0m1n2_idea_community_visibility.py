"""idea community visibility preference

Revision ID: o7j8k9l0m1n2
Revises: n6i7j8k9l0m1
Create Date: 2026-07-26 22:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o7j8k9l0m1n2"
down_revision: Union[str, Sequence[str], None] = "n6i7j8k9l0m1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column(
            "community_visibility",
            sa.String(32),
            nullable=False,
            server_default="members",
        ),
    )


def downgrade() -> None:
    op.drop_column("event_suggestions", "community_visibility")
