"""normalize inconsistent member major values

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-07-13 13:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safe abbreviation aliases (unambiguous in this org).
    op.execute(
        sa.text(
            """
            UPDATE members
            SET major = 'Computer Science'
            WHERE lower(trim(major)) IN ('cs', 'c.s', 'c.s.', 'computer science')
            """,
        ),
    )

    # Case-only / spacing inconsistencies → Title Case words.
    op.execute(
        sa.text(
            """
            UPDATE members
            SET major = initcap(lower(trim(regexp_replace(major, '\\s+', ' ', 'g'))))
            WHERE major IS NOT NULL
              AND major <> initcap(lower(trim(regexp_replace(major, '\\s+', ' ', 'g'))))
            """,
        ),
    )


def downgrade() -> None:
    # Data cleanup is not safely reversible (original casings/abbreviations lost).
    pass
