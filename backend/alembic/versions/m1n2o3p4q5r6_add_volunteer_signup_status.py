"""Add approval status to event volunteer signups.

Revision ID: m1n2o3p4q5r6
Revises: l0a1b2c3d4e5
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, Sequence[str], None] = "l0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

volunteer_signup_status = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="eventvolunteersignupstatus",
    create_type=False,
)


def upgrade() -> None:
    volunteer_signup_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "event_volunteer_signups",
        sa.Column(
            "status",
            volunteer_signup_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "event_volunteer_signups",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "event_volunteer_signups",
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_event_volunteer_signups_reviewed_by_id",
        "event_volunteer_signups",
        "users",
        ["reviewed_by_id"],
        ["id"],
    )
    # Preserve prior behavior for existing signups.
    op.execute(
        "UPDATE event_volunteer_signups SET status = 'approved' "
        "WHERE status = 'pending'"
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_event_volunteer_signups_reviewed_by_id",
        "event_volunteer_signups",
        type_="foreignkey",
    )
    op.drop_column("event_volunteer_signups", "reviewed_by_id")
    op.drop_column("event_volunteer_signups", "reviewed_at")
    op.drop_column("event_volunteer_signups", "status")
    volunteer_signup_status.drop(op.get_bind(), checkfirst=True)
