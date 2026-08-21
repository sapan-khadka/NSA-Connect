"""add indexes for calendar, tasks, finance, and volunteer slot lookups

Revision ID: aa1b2c3d4e5f
Revises: z0a1b2c3d4e5
Create Date: 2026-08-19 00:00:00.000000

Postgres does not index foreign keys automatically. These columns are filtered
or ordered on list/scan paths (upcoming/past events, event tasks, treasury
books, volunteer slots).
"""

from typing import Sequence, Union

from alembic import op

revision: str = "aa1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "z0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEXES: tuple[tuple[str, str, list[str]], ...] = (
    ("ix_events_starts_at", "events", ["starts_at"]),
    ("ix_event_tasks_event_id", "event_tasks", ["event_id"]),
    ("ix_finance_entries_event_id", "finance_entries", ["event_id"]),
    ("ix_finance_entries_created_at", "finance_entries", ["created_at"]),
    ("ix_volunteer_slots_event_id", "volunteer_slots", ["event_id"]),
)


def upgrade() -> None:
    for name, table, columns in _INDEXES:
        op.create_index(op.f(name), table, columns, unique=False)


def downgrade() -> None:
    for name, table, _columns in reversed(_INDEXES):
        op.drop_index(op.f(name), table_name=table)
