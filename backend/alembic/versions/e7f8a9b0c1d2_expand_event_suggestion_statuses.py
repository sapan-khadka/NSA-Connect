"""expand event suggestion statuses for ideas pipeline

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-07-26 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
                WHEN 'noted' THEN 'under_discussion'
                ELSE 'pending_review'
            END
        )::eventsuggestionstatus
        """
    )
    op.execute(
        "ALTER TABLE event_suggestions "
        "ALTER COLUMN status SET DEFAULT 'pending_review'"
    )
    op.execute("DROP TYPE eventsuggestionstatus_old")


def downgrade() -> None:
    op.execute("ALTER TYPE eventsuggestionstatus RENAME TO eventsuggestionstatus_old")
    op.execute(
        """
        CREATE TYPE eventsuggestionstatus AS ENUM (
            'submitted',
            'noted'
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
                WHEN 'under_discussion' THEN 'noted'
                ELSE 'submitted'
            END
        )::eventsuggestionstatus
        """
    )
    op.execute(
        "ALTER TABLE event_suggestions "
        "ALTER COLUMN status SET DEFAULT 'submitted'"
    )
    op.execute("DROP TYPE eventsuggestionstatus_old")
