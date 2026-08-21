"""add event_tasks.assignee_id index for my-tasks and due-date scans

Revision ID: ab2c3d4e5f6a
Revises: aa1b2c3d4e5f
Create Date: 2026-08-19 00:10:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "ab2c3d4e5f6a"
down_revision: Union[str, Sequence[str], None] = "aa1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_event_tasks_assignee_id"),
        "event_tasks",
        ["assignee_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_event_tasks_assignee_id"), table_name="event_tasks")
