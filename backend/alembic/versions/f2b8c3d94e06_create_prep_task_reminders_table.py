"""create prep_task_reminders table

Revision ID: f2b8c3d94e06
Revises: e1a4c9f82b07
Create Date: 2026-06-25 14:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2b8c3d94e06"
down_revision: Union[str, Sequence[str], None] = "e1a4c9f82b07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prep_task_reminders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("prep_task_id", sa.Integer(), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=False),
        sa.Column(
            "reminder_type",
            sa.Enum("due_soon", name="remindertype"),
            nullable=False,
        ),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assignee_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["prep_task_id"], ["prep_tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "prep_task_id",
            "reminder_type",
            "assignee_id",
            name="uq_prep_task_reminders_task_type_assignee",
        ),
    )
    op.create_index(
        op.f("ix_prep_task_reminders_id"),
        "prep_task_reminders",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_prep_task_reminders_id"), table_name="prep_task_reminders")
    op.drop_table("prep_task_reminders")
    op.execute("DROP TYPE IF EXISTS remindertype")
