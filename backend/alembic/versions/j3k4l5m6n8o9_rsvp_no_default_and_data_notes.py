"""rsvp no default and document legacy going records

Revision ID: j3k4l5m6n8o9
Revises: i2j3k4l5m6n7
Create Date: 2026-06-29 18:00:00.000000

No-response is represented by the absence of an event_rsvps row.

Legacy data note (manual review required before deploy):
- Rows created before the three-state RSVP migration may have status='going'
  even when the member never chose Going (legacy POST /rsvp or migration backfill).
- There is no reliable way to distinguish implicit defaults from explicit Going
  responses in existing rows (created_at == updated_at matches both cases).
- Do NOT auto-delete or reset these rows in this migration. See
  backend/docs/RSVP_DATA_CLEANUP.md for review queries.

"""
from typing import Sequence, Union

from alembic import op

revision: str = "j3k4l5m6n8o9"
down_revision: Union[str, Sequence[str], None] = "i2j3k4l5m6n7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ORM default removed in app code; ensure DB has no implicit default.
    op.execute(
        "ALTER TABLE event_rsvps ALTER COLUMN status DROP DEFAULT",
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE event_rsvps ALTER COLUMN status SET DEFAULT 'going'",
    )
