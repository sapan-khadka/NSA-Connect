from datetime import UTC, datetime

from app.models.event_task import (
    EventTask,
    EventTaskChecklistItem,
    EventTaskKind,
    checklist_items_from_group,
    sync_checklist_status,
)
from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem


def test_group_table_names():
    assert PrepTaskGroup.__tablename__ == "prep_task_groups"
    assert PrepTaskGroupItem.__tablename__ == "prep_task_group_items"
    assert EventTaskChecklistItem.__tablename__ == "event_task_checklist_items"


def test_checklist_items_from_group():
    food_group = PrepTaskGroup(
        group_name="Food & Beverage",
        items=[
            PrepTaskGroupItem(label="Order catering", sort_order=0),
            PrepTaskGroupItem(label="Confirm dietary restrictions", sort_order=1),
        ],
    )

    checklist = checklist_items_from_group(food_group)

    assert len(checklist) == 2
    assert checklist[0].label == "Order catering"
    assert checklist[1].sort_order == 1
    assert all(not item.is_completed for item in checklist)


def test_checklist_event_task_completion_and_overdue():
    due_future = datetime(2026, 12, 1, tzinfo=UTC)
    due_past = datetime(2020, 1, 1, tzinfo=UTC)

    incomplete_task = EventTask(
        event_id=1,
        task_kind=EventTaskKind.CHECKLIST,
        title="Setup",
        due_date=due_future,
        assignee_id=2,
        checklist_items=[
            EventTaskChecklistItem(label="Task A", sort_order=0, is_completed=True),
            EventTaskChecklistItem(label="Task B", sort_order=1, is_completed=False),
        ],
    )
    sync_checklist_status(incomplete_task)

    complete_task = EventTask(
        event_id=1,
        task_kind=EventTaskKind.CHECKLIST,
        title="Cleanup",
        due_date=due_past,
        assignee_id=2,
        checklist_items=[
            EventTaskChecklistItem(label="Task A", sort_order=0, is_completed=True),
        ],
    )
    sync_checklist_status(complete_task)

    assert incomplete_task.is_checklist_complete is False
    assert incomplete_task.is_overdue is False
    assert complete_task.is_checklist_complete is True
    assert complete_task.is_overdue is True
