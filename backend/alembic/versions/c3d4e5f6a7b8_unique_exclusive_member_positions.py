"""enforce one member per exclusive position

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-06-29 23:45:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE members AS m
            SET position = 'member'
            FROM (
                SELECT id
                FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY position ORDER BY id
                        ) AS position_rank
                    FROM members
                    WHERE position <> 'member'
                ) AS ranked
                WHERE position_rank > 1
            ) AS duplicates
            WHERE m.id = duplicates.id
            """,
        ),
    )
    op.create_index(
        "ix_members_exclusive_position",
        "members",
        ["position"],
        unique=True,
        postgresql_where=sa.text("position <> 'member'"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_members_exclusive_position",
        table_name="members",
        postgresql_where=sa.text("position <> 'member'"),
    )
