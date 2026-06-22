"""add student profile fields to members

Revision ID: a3c8d91e4f20
Revises: 20f9bf58ffe3
Create Date: 2026-06-21 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3c8d91e4f20"
down_revision: Union[str, Sequence[str], None] = "20f9bf58ffe3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("members", sa.Column("student_id", sa.String(length=20), nullable=True))
    op.add_column("members", sa.Column("major", sa.String(length=255), nullable=True))
    op.add_column(
        "members",
        sa.Column("graduation_year", sa.Integer(), nullable=True),
    )

    op.execute(
        sa.text(
            "UPDATE members SET student_id = '000000', major = 'Undeclared', "
            "graduation_year = 2028 WHERE student_id IS NULL"
        )
    )

    op.alter_column("members", "student_id", nullable=False)
    op.alter_column("members", "major", nullable=False)
    op.alter_column("members", "graduation_year", nullable=False)
    op.create_unique_constraint("uq_members_student_id", "members", ["student_id"])


def downgrade() -> None:
    op.drop_constraint("uq_members_student_id", "members", type_="unique")
    op.drop_column("members", "graduation_year")
    op.drop_column("members", "major")
    op.drop_column("members", "student_id")
