"""unify event_tasks with prep_tasks

Revision ID: b1c2d3e4f5a6
Revises: a9b3c4d5e6f7
Create Date: 2026-06-29 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a9b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

eventtaskkind = postgresql.ENUM(
    "simple",
    "checklist",
    name="eventtaskkind",
    create_type=False,
)


def _derive_status(completed: int, total: int) -> str:
    if total == 0 or completed == 0:
        return "todo"
    if completed == total:
        return "done"
    return "in_progress"


def upgrade() -> None:
    bind = op.get_bind()
    eventtaskkind.create(bind, checkfirst=True)

    op.add_column(
        "event_tasks",
        sa.Column(
            "task_kind",
            eventtaskkind,
            nullable=False,
            server_default="simple",
        ),
    )
    op.add_column(
        "event_tasks",
        sa.Column("group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_event_tasks_group_id",
        "event_tasks",
        "prep_task_groups",
        ["group_id"],
        ["id"],
    )
    op.alter_column("event_tasks", "created_by_id", nullable=True)

    op.create_table(
        "event_task_checklist_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_task_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["event_task_id"], ["event_tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_task_id",
            "sort_order",
            name="uq_event_task_checklist_order",
        ),
    )
    op.create_index(
        op.f("ix_event_task_checklist_items_id"),
        "event_task_checklist_items",
        ["id"],
        unique=False,
    )

    prep_tasks = sa.table(
        "prep_tasks",
        sa.column("id", sa.Integer),
        sa.column("event_id", sa.Integer),
        sa.column("group_id", sa.Integer),
        sa.column("due_date", sa.DateTime(timezone=True)),
        sa.column("assignee_id", sa.Integer),
    )
    prep_task_groups = sa.table(
        "prep_task_groups",
        sa.column("id", sa.Integer),
        sa.column("group_name", sa.String),
    )
    prep_task_checklist_items = sa.table(
        "prep_task_checklist_items",
        sa.column("id", sa.Integer),
        sa.column("prep_task_id", sa.Integer),
        sa.column("label", sa.String),
        sa.column("is_completed", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    event_tasks = sa.table(
        "event_tasks",
        sa.column("id", sa.Integer),
        sa.column("event_id", sa.Integer),
        sa.column("task_kind", sa.String),
        sa.column("title", sa.String),
        sa.column("description", sa.Text),
        sa.column("group_id", sa.Integer),
        sa.column("assignee_id", sa.Integer),
        sa.column("status", sa.String),
        sa.column("due_date", sa.DateTime(timezone=True)),
        sa.column("created_by_id", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    event_task_checklist_items = sa.table(
        "event_task_checklist_items",
        sa.column("id", sa.Integer),
        sa.column("event_task_id", sa.Integer),
        sa.column("label", sa.String),
        sa.column("is_completed", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )

    rows = bind.execute(
        sa.select(
            prep_tasks.c.id,
            prep_tasks.c.event_id,
            prep_tasks.c.group_id,
            prep_tasks.c.due_date,
            prep_tasks.c.assignee_id,
            prep_task_groups.c.group_name,
        ).select_from(
            prep_tasks.join(
                prep_task_groups,
                prep_tasks.c.group_id == prep_task_groups.c.id,
            ),
        ),
    ).fetchall()

    id_map: dict[int, int] = {}
    for row in rows:
        checklist_rows = bind.execute(
            sa.select(
                prep_task_checklist_items.c.is_completed,
                prep_task_checklist_items.c.sort_order,
            ).where(prep_task_checklist_items.c.prep_task_id == row.id),
        ).fetchall()
        completed = sum(1 for item in checklist_rows if item.is_completed)
        total = len(checklist_rows)
        status = _derive_status(completed, total)

        new_id = bind.execute(
            event_tasks.insert().values(
                event_id=row.event_id,
                task_kind="checklist",
                title=row.group_name,
                description="",
                group_id=row.group_id,
                assignee_id=row.assignee_id,
                status=status,
                due_date=row.due_date,
                created_by_id=None,
                created_at=row.due_date,
            ).returning(event_tasks.c.id),
        ).scalar_one()
        id_map[row.id] = new_id

        old_items = bind.execute(
            sa.select(
                prep_task_checklist_items.c.label,
                prep_task_checklist_items.c.is_completed,
                prep_task_checklist_items.c.sort_order,
            ).where(prep_task_checklist_items.c.prep_task_id == row.id),
        ).fetchall()
        for item in old_items:
            bind.execute(
                event_task_checklist_items.insert().values(
                    event_task_id=new_id,
                    label=item.label,
                    is_completed=item.is_completed,
                    sort_order=item.sort_order,
                ),
            )

    op.add_column(
        "prep_task_reminders",
        sa.Column("event_task_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_prep_task_reminders_event_task_id",
        "prep_task_reminders",
        "event_tasks",
        ["event_task_id"],
        ["id"],
    )

    prep_task_reminders = sa.table(
        "prep_task_reminders",
        sa.column("id", sa.Integer),
        sa.column("prep_task_id", sa.Integer),
        sa.column("event_task_id", sa.Integer),
    )
    reminder_rows = bind.execute(
        sa.select(
            prep_task_reminders.c.id,
            prep_task_reminders.c.prep_task_id,
        ),
    ).fetchall()
    for reminder in reminder_rows:
        mapped_id = id_map.get(reminder.prep_task_id)
        if mapped_id is not None:
            bind.execute(
                prep_task_reminders.update()
                .where(prep_task_reminders.c.id == reminder.id)
                .values(event_task_id=mapped_id),
            )

    op.drop_constraint(
        "uq_prep_task_reminders_task_type_assignee",
        "prep_task_reminders",
        type_="unique",
    )
    op.drop_constraint(
        "prep_task_reminders_prep_task_id_fkey",
        "prep_task_reminders",
        type_="foreignkey",
    )
    op.drop_column("prep_task_reminders", "prep_task_id")
    op.alter_column("prep_task_reminders", "event_task_id", nullable=False)
    op.create_unique_constraint(
        "uq_event_task_reminders_task_type_assignee",
        "prep_task_reminders",
        ["event_task_id", "reminder_type", "assignee_id"],
    )

    op.drop_table("prep_task_checklist_items")
    op.drop_table("prep_tasks")


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for task unification")
