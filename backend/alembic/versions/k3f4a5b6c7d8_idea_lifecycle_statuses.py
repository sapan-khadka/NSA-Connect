"""idea lifecycle statuses: submitted, internal_review, published

Revision ID: k3f4a5b6c7d8
Revises: j2e3f4a5b6c7
Create Date: 2026-07-26 14:20:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = "j2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute("ALTER TYPE eventsuggestionstatus RENAME TO eventsuggestionstatus_old")
    op.execute(
        """
        CREATE TYPE eventsuggestionstatus AS ENUM (
            'submitted',
            'internal_review',
            'published',
            'approved',
            'rejected',
            'converted',
            'archived'
        )
        """
    )
    op.execute("ALTER TABLE event_suggestions ALTER COLUMN status DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE event_suggestions
        ALTER COLUMN status TYPE eventsuggestionstatus
        USING (
            CASE status::text
                WHEN 'pending_review' THEN 'submitted'
                WHEN 'under_discussion' THEN 'internal_review'
                ELSE status::text
            END
        )::eventsuggestionstatus
        """
    )
    op.execute(
        "ALTER TABLE event_suggestions "
        "ALTER COLUMN status SET DEFAULT 'submitted'"
    )
    op.execute("DROP TYPE eventsuggestionstatus_old")


def downgrade() -> None:
    op.execute("ALTER TYPE eventsuggestionstatus RENAME TO eventsuggestionstatus_old")
    op.execute(
        """
        CREATE TYPE eventsuggestionstatus AS ENUM (
            'pending_review',
            'under_discussion',
            'approved',
            'rejected',
            'converted',
            'archived'
        )
        """
    )
    op.execute("ALTER TABLE event_suggestions ALTER COLUMN status DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE event_suggestions
        ALTER COLUMN status TYPE eventsuggestionstatus
        USING (
            CASE status::text
                WHEN 'submitted' THEN 'pending_review'
                WHEN 'internal_review' THEN 'under_discussion'
                WHEN 'published' THEN 'under_discussion'
                ELSE status::text
            END
        )::eventsuggestionstatus
        """
    )
    op.execute(
        "ALTER TABLE event_suggestions "
        "ALTER COLUMN status SET DEFAULT 'pending_review'"
    )
    op.execute("DROP TYPE eventsuggestionstatus_old")
    op.drop_column("event_suggestions", "published_at")
