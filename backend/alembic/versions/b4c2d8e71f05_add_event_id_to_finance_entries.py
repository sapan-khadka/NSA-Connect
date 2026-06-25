"""add event_id to finance_entries

Revision ID: b4c2d8e71f05
Revises: a9f1e3b72c04
Create Date: 2026-06-25 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b4c2d8e71f05"
down_revision: Union[str, Sequence[str], None] = "a9f1e3b72c04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("finance_entries", sa.Column("event_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_finance_entries_event_id_events",
        "finance_entries",
        "events",
        ["event_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_finance_entries_event_id_events",
        "finance_entries",
        type_="foreignkey",
    )
    op.drop_column("finance_entries", "event_id")
