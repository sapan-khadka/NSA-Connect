"""create volunteer slots and signups tables

Revision ID: f3a1b2c94d08
Revises: e1a4c9f82b07
Create Date: 2026-06-17 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a1b2c94d08"
down_revision: Union[str, Sequence[str], None] = "b4c2d8e71f05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "volunteer_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("capacity > 0", name="ck_volunteer_slots_capacity_positive"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_volunteer_slots_id"), "volunteer_slots", ["id"], unique=False)

    op.create_table(
        "volunteer_signups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slot_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["slot_id"], ["volunteer_slots.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slot_id", "member_id", name="uq_volunteer_signups_slot_member"),
    )
    op.create_index(op.f("ix_volunteer_signups_id"), "volunteer_signups", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_volunteer_signups_id"), table_name="volunteer_signups")
    op.drop_table("volunteer_signups")
    op.drop_index(op.f("ix_volunteer_slots_id"), table_name="volunteer_slots")
    op.drop_table("volunteer_slots")
