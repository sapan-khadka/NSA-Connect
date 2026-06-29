"""create finance_change_requests table

Revision ID: a9b3c4d5e6f7
Revises: f8d2a3b4c5e6
Create Date: 2026-06-29 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a9b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f8d2a3b4c5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

financechangeaction = postgresql.ENUM(
    "update",
    "delete",
    name="financechangeaction",
    create_type=False,
)
financechangestatus = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="financechangestatus",
    create_type=False,
)


def upgrade() -> None:
    financechangeaction.create(op.get_bind(), checkfirst=True)
    financechangestatus.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "finance_change_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entry_id", sa.Integer(), nullable=False),
        sa.Column("action", financechangeaction, nullable=False),
        sa.Column("status", financechangestatus, nullable=False, server_default="pending"),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["entry_id"], ["finance_entries.id"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_finance_change_requests_id"),
        "finance_change_requests",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_finance_change_requests_id"),
        table_name="finance_change_requests",
    )
    op.drop_table("finance_change_requests")
    financechangestatus.drop(op.get_bind(), checkfirst=True)
    financechangeaction.drop(op.get_bind(), checkfirst=True)
