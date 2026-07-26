"""add converted_event_id to event suggestions

Revision ID: i1d2e3f4a5b6
Revises: h0c1d2e3f4a5
Create Date: 2026-07-26 13:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "h0c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column("converted_event_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_event_suggestions_converted_event_id",
        "event_suggestions",
        "events",
        ["converted_event_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_event_suggestions_converted_event_id"),
        "event_suggestions",
        ["converted_event_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_suggestions_converted_event_id"),
        table_name="event_suggestions",
    )
    op.drop_constraint(
        "fk_event_suggestions_converted_event_id",
        "event_suggestions",
        type_="foreignkey",
    )
    op.drop_column("event_suggestions", "converted_event_id")
