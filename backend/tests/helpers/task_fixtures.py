from datetime import datetime

from sqlalchemy.orm import Session

from app.models.event_task import (
    EventTask,
    EventTaskChecklistItem,
    EventTaskKind,
    sync_checklist_status,
)
from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem


def seed_checklist_event_task(
    db_session: Session,
    *,
    event_id: int,
    group_name: str,
    due_date: datetime,
    assignee_id: int | None = None,
    label: str = "Checklist item",
    completed: bool = False,
) -> EventTask:
    group = PrepTaskGroup(group_name=group_name)
    db_session.add(group)
    db_session.flush()

    task = EventTask(
        event_id=event_id,
        task_kind=EventTaskKind.CHECKLIST,
        title=group_name,
        group_id=group.id,
        due_date=due_date,
        assignee_id=assignee_id,
        checklist_items=[
            EventTaskChecklistItem(
                label=label,
                sort_order=0,
                is_completed=completed,
            ),
        ],
    )
    sync_checklist_status(task)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)
    return task


def seed_prep_task_group(
    db_session: Session,
    group_name: str,
    labels: list[str],
) -> PrepTaskGroup:
    group = PrepTaskGroup(
        group_name=group_name,
        items=[
            PrepTaskGroupItem(label=label, sort_order=index)
            for index, label in enumerate(labels)
        ],
    )
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group
