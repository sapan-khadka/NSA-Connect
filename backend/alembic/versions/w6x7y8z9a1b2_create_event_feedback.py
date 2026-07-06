"""create event feedback table

Revision ID: w6x7y8z9a1b2
Revises: v5w6x7y8z9a1
Create Date: 2026-07-06 02:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w6x7y8z9a1b2"
down_revision: Union[str, Sequence[str], None] = "v5w6x7y8z9a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_event_feedback_rating_range",
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_event_feedback_event_member",
        ),
    )
    op.create_index(
        op.f("ix_event_feedback_event_id"),
        "event_feedback",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_feedback_id"),
        "event_feedback",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_feedback_member_id"),
        "event_feedback",
        ["member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_event_feedback_member_id"), table_name="event_feedback")
    op.drop_index(op.f("ix_event_feedback_id"), table_name="event_feedback")
    op.drop_index(op.f("ix_event_feedback_event_id"), table_name="event_feedback")
    op.drop_table("event_feedback")
