"""create prep task tables

Revision ID: c4d8e12f6a90
Revises: b7e2f4a91c03
Create Date: 2026-06-24 12:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d8e12f6a90"
down_revision: Union[str, Sequence[str], None] = "b7e2f4a91c03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prep_task_groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_name"),
    )
    op.create_index(
        op.f("ix_prep_task_groups_id"),
        "prep_task_groups",
        ["id"],
        unique=False,
    )

    op.create_table(
        "prep_task_group_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["prep_task_groups.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "group_id",
            "sort_order",
            name="uq_prep_task_group_items_order",
        ),
    )
    op.create_index(
        op.f("ix_prep_task_group_items_id"),
        "prep_task_group_items",
        ["id"],
        unique=False,
    )

    op.create_table(
        "prep_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["assignee_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["prep_task_groups.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_prep_tasks_id"), "prep_tasks", ["id"], unique=False)

    op.create_table(
        "prep_task_checklist_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("prep_task_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["prep_task_id"], ["prep_tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "prep_task_id",
            "sort_order",
            name="uq_prep_task_checklist_order",
        ),
    )
    op.create_index(
        op.f("ix_prep_task_checklist_items_id"),
        "prep_task_checklist_items",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_prep_task_checklist_items_id"),
        table_name="prep_task_checklist_items",
    )
    op.drop_table("prep_task_checklist_items")
    op.drop_index(op.f("ix_prep_tasks_id"), table_name="prep_tasks")
    op.drop_table("prep_tasks")
    op.drop_index(
        op.f("ix_prep_task_group_items_id"),
        table_name="prep_task_group_items",
    )
    op.drop_table("prep_task_group_items")
    op.drop_index(op.f("ix_prep_task_groups_id"), table_name="prep_task_groups")
    op.drop_table("prep_task_groups")
