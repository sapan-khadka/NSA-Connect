"""create event_tasks table

Revision ID: f8d2a3b4c5e6
Revises: e7c1a2b3d4f5
Create Date: 2026-06-29 10:05:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f8d2a3b4c5e6"
down_revision: Union[str, Sequence[str], None] = "e7c1a2b3d4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

eventtaskstatus = postgresql.ENUM(
    "todo",
    "in_progress",
    "done",
    name="eventtaskstatus",
    create_type=False,
)


def upgrade() -> None:
    eventtaskstatus.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "event_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("status", eventtaskstatus, nullable=False, server_default="todo"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_note", sa.Text(), nullable=True),
        sa.Column("completion_photo_url", sa.String(length=2048), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["assignee_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_event_tasks_id"), "event_tasks", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_tasks_id"), table_name="event_tasks")
    op.drop_table("event_tasks")
    eventtaskstatus.drop(op.get_bind(), checkfirst=True)
