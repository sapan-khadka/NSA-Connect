"""Add waitlisted RSVP status for capacity waitlist.

Revision ID: l0a1b2c3d4e5
Revises: k9f0a1b2c3d4
Create Date: 2026-07-21
"""

from typing import Sequence, Union

from alembic import op

revision: str = "l0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "k9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres enum extension; no-op-safe for IF NOT EXISTS on PG 9.1+ variants.
    op.execute("ALTER TYPE rsvpstatus ADD VALUE IF NOT EXISTS 'waitlisted'")


def downgrade() -> None:
    # Enum values are not removed safely in Postgres.
    pass
