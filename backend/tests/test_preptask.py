from datetime import UTC, datetime

from app.models.preptask import (
    PrepTask,
    PrepTaskChecklistItem,
    PrepTaskGroup,
    PrepTaskGroupItem,
    checklist_items_from_group,
)


def test_prep_task_table_names():
    assert PrepTask.__tablename__ == "prep_tasks"
    assert PrepTaskGroup.__tablename__ == "prep_task_groups"
    assert PrepTaskGroupItem.__tablename__ == "prep_task_group_items"
    assert PrepTaskChecklistItem.__tablename__ == "prep_task_checklist_items"


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


def test_prep_task_completion_and_overdue():
    due_future = datetime(2026, 12, 1, tzinfo=UTC)
    due_past = datetime(2020, 1, 1, tzinfo=UTC)

    incomplete_task = PrepTask(
        event_id=1,
        group_id=1,
        due_date=due_future,
        assignee_id=2,
        checklist_items=[
            PrepTaskChecklistItem(label="Task A", sort_order=0, is_completed=True),
            PrepTaskChecklistItem(label="Task B", sort_order=1, is_completed=False),
        ],
    )
    complete_task = PrepTask(
        event_id=1,
        group_id=1,
        due_date=due_past,
        assignee_id=2,
        checklist_items=[
            PrepTaskChecklistItem(label="Task A", sort_order=0, is_completed=True),
        ],
    )

    assert incomplete_task.is_complete is False
    assert incomplete_task.is_overdue is False
    assert complete_task.is_complete is True
    assert complete_task.is_overdue is True
