"""create semester dues settings and member dues tables

Revision ID: n7o8p9q0r1s3
Revises: m6n7o8p9q0r2
Create Date: 2026-07-04 19:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "n7o8p9q0r1s3"
down_revision: Union[str, Sequence[str], None] = "m6n7o8p9q0r2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

dues_payment_method = postgresql.ENUM(
    "venmo",
    "cash",
    "other",
    "online",
    name="duespaymentmethod",
    create_type=False,
)


def upgrade() -> None:
    dues_payment_method.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "semester_dues_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("semester", sa.String(length=16), nullable=False),
        sa.Column("default_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("semester"),
    )
    op.create_index(
        op.f("ix_semester_dues_settings_id"),
        "semester_dues_settings",
        ["id"],
        unique=False,
    )

    op.create_table(
        "member_dues",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("semester", sa.String(length=16), nullable=False),
        sa.Column("amount_owed", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_method", dues_payment_method, nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("finance_entry_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["finance_entry_id"], ["finance_entries.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("member_id", "semester", name="uq_member_dues_member_semester"),
    )
    op.create_index(op.f("ix_member_dues_id"), "member_dues", ["id"], unique=False)
    op.create_index(
        op.f("ix_member_dues_member_id"),
        "member_dues",
        ["member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_member_dues_semester"),
        "member_dues",
        ["semester"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_member_dues_semester"), table_name="member_dues")
    op.drop_index(op.f("ix_member_dues_member_id"), table_name="member_dues")
    op.drop_index(op.f("ix_member_dues_id"), table_name="member_dues")
    op.drop_table("member_dues")

    op.drop_index(op.f("ix_semester_dues_settings_id"), table_name="semester_dues_settings")
    op.drop_table("semester_dues_settings")

    dues_payment_method.drop(op.get_bind(), checkfirst=True)
