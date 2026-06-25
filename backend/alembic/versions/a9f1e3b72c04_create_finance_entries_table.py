"""create finance_entries table

Revision ID: a9f1e3b72c04
Revises: f2b8c3d94e06
Create Date: 2026-06-25 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9f1e3b72c04"
down_revision: Union[str, Sequence[str], None] = "f2b8c3d94e06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "finance_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "entry_type",
            sa.Enum("income", "expense", name="financeentrytype"),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.Enum(
                "membership_dues",
                "fundraising",
                "donation",
                "sponsorship",
                "food_beverage",
                "venue",
                "supplies",
                "marketing",
                "travel",
                "event",
                "other",
                name="financecategory",
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("receipt_url", sa.String(length=2048), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_finance_entries_id"), "finance_entries", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_finance_entries_id"), table_name="finance_entries")
    op.drop_table("finance_entries")
    op.execute("DROP TYPE IF EXISTS financeentrytype")
    op.execute("DROP TYPE IF EXISTS financecategory")
