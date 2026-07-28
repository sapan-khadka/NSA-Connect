"""allow multiple polls per event suggestion

Revision ID: m5h6i7j8k9l0
Revises: l4g5h6i7j8k9
Create Date: 2026-07-26 14:40:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "m5h6i7j8k9l0"
down_revision: Union[str, Sequence[str], None] = "l4g5h6i7j8k9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_event_suggestion_polls_suggestion_id",
        "event_suggestion_polls",
        type_="unique",
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_event_suggestion_polls_suggestion_id",
        "event_suggestion_polls",
        ["suggestion_id"],
    )
