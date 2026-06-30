"""sync member auth roles from assigned positions

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-30 00:15:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE members
            SET role = 'board'
            WHERE role IN ('president', 'treasurer')
              AND position NOT IN ('president', 'treasurer')
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE members
            SET role = 'president'
            WHERE position = 'president'
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE members
            SET role = 'treasurer'
            WHERE position = 'treasurer'
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE members
            SET role = 'board'
            WHERE role = 'general'
              AND position IN (
                  'vice_president',
                  'secretary',
                  'event_manager',
                  'public_relations_officer',
                  'new_student_representative'
              )
            """,
        ),
    )


def downgrade() -> None:
    pass
