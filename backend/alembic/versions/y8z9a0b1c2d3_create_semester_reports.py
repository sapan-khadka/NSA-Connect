"""create semester reports table

Revision ID: y8z9a0b1c2d3
Revises: x7y8z9a1b2c3
Create Date: 2026-07-06 04:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "y8z9a0b1c2d3"
down_revision: Union[str, Sequence[str], None] = "x7y8z9a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS reportrangetype")
    op.create_table(
        "semester_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("range_type", sa.String(length=16), nullable=False),
        sa.Column("semester", sa.String(length=32), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("generated_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["generated_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_semester_reports_id"),
        "semester_reports",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_semester_reports_id"), table_name="semester_reports")
    op.drop_table("semester_reports")
