"""create event guest check-ins table

Revision ID: s2t3u4v5w6x8
Revises: r1s2t3u4v5w7
Create Date: 2026-07-05 22:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "s2t3u4v5w6x8"
down_revision: Union[str, Sequence[str], None] = "r1s2t3u4v5w7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

guest_affiliation_type = postgresql.ENUM(
    "guest_of_member",
    "faculty_staff",
    name="guestaffiliationtype",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE guestaffiliationtype AS ENUM ('guest_of_member', 'faculty_staff');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "event_guest_check_ins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("guest_name", sa.String(length=255), nullable=False),
        sa.Column("affiliation_type", guest_affiliation_type, nullable=True),
        sa.Column("related_member_name", sa.String(length=255), nullable=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_event_guest_check_ins_id"),
        "event_guest_check_ins",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_guest_check_ins_event_id"),
        "event_guest_check_ins",
        ["event_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_guest_check_ins_event_id"),
        table_name="event_guest_check_ins",
    )
    op.drop_index(op.f("ix_event_guest_check_ins_id"), table_name="event_guest_check_ins")
    op.drop_table("event_guest_check_ins")
    guest_affiliation_type.drop(op.get_bind(), checkfirst=True)
