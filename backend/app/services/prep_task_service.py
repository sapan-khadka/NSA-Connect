from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.member import Member, MemberRole, MemberStatus
from app.models.preptask import (
    PrepTask,
    PrepTaskChecklistItem,
    PrepTaskGroup,
    checklist_items_from_group,
)
from app.schemas.preptask import (
    PrepTaskCreateRequest,
    PrepTaskChecklistItemUpdateRequest,
    PrepTaskUpdateRequest,
)
from app.services.event_service import EventNotFoundError


class PrepTaskGroupNotFoundError(Exception):
    pass


class InvalidAssigneeError(Exception):
    """Assignee must be an approved board member or higher."""


def _validate_assignee(db: Session, assignee_id: int | None) -> None:
    if assignee_id is None:
        return

    assignee = db.get(Member, assignee_id)
    if assignee is None or assignee.status != MemberStatus.APPROVED:
        raise InvalidAssigneeError
    if not assignee.has_role_at_least(MemberRole.BOARD):
        raise InvalidAssigneeError


class InvalidPrepTaskDueDateError(Exception):
    pass


class PrepTaskNotFoundError(Exception):
    pass


class PrepTaskForbiddenError(Exception):
    pass


class PrepTaskChecklistItemNotFoundError(Exception):
    pass


def create_prep_task_for_event(
    db: Session,
    event_id: int,
    data: PrepTaskCreateRequest,
) -> PrepTask:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    group = db.scalar(
        select(PrepTaskGroup)
        .where(PrepTaskGroup.group_name == data.group_name)
        .options(selectinload(PrepTaskGroup.items)),
    )
    if group is None:
        raise PrepTaskGroupNotFoundError

    _validate_due_date(data.due_date, event.starts_at)

    assignee_id = data.assignee_id
    _validate_assignee(db, assignee_id)

    prep_task = PrepTask(
        event_id=event_id,
        group_id=group.id,
        due_date=data.due_date,
        assignee_id=assignee_id,
        checklist_items=checklist_items_from_group(group),
    )
    db.add(prep_task)
    db.commit()
    db.refresh(prep_task)

    prep_task.group = group
    return prep_task


def _validate_due_date(due_date: datetime, event_starts_at: datetime) -> None:
    due_date = _as_utc(due_date)
    event_starts_at = _as_utc(event_starts_at)
    now = datetime.now(UTC)
    if due_date <= now:
        raise InvalidPrepTaskDueDateError("Prep task due date must be in the future")
    if due_date >= event_starts_at:
        raise InvalidPrepTaskDueDateError(
            "Prep task due date must be before the event starts",
        )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _load_prep_task(db: Session, task_id: int) -> PrepTask | None:
    return db.scalar(
        select(PrepTask)
        .where(PrepTask.id == task_id)
        .options(
            selectinload(PrepTask.checklist_items),
            selectinload(PrepTask.group),
        ),
    )


def update_prep_task(
    db: Session,
    task_id: int,
    data: PrepTaskUpdateRequest,
    current_member: Member,
) -> PrepTask:
    prep_task = _load_prep_task(db, task_id)
    if prep_task is None:
        raise PrepTaskNotFoundError

    updates = data.model_dump(exclude_unset=True)
    is_board = current_member.has_role_at_least(MemberRole.BOARD)
    is_assignee = prep_task.assignee_id == current_member.id

    if "assignee_id" in updates and not is_board:
        raise PrepTaskForbiddenError

    if "is_complete" in updates and not (is_board or is_assignee):
        raise PrepTaskForbiddenError

    if "assignee_id" in updates:
        assignee_id = updates["assignee_id"]
        _validate_assignee(db, assignee_id)
        prep_task.assignee_id = assignee_id

    if "is_complete" in updates:
        completed = updates["is_complete"]
        for item in prep_task.checklist_items:
            item.is_completed = completed

    db.commit()
    reloaded = _load_prep_task(db, task_id)
    assert reloaded is not None
    return reloaded


def update_prep_task_checklist_item(
    db: Session,
    task_id: int,
    item_id: int,
    data: PrepTaskChecklistItemUpdateRequest,
    current_member: Member,
) -> PrepTask:
    prep_task = _load_prep_task(db, task_id)
    if prep_task is None:
        raise PrepTaskNotFoundError

    is_board = current_member.has_role_at_least(MemberRole.BOARD)
    is_assignee = prep_task.assignee_id == current_member.id
    if not (is_board or is_assignee):
        raise PrepTaskForbiddenError

    checklist_item = next(
        (item for item in prep_task.checklist_items if item.id == item_id),
        None,
    )
    if checklist_item is None:
        raise PrepTaskChecklistItemNotFoundError

    checklist_item.is_completed = data.is_completed
    db.commit()

    reloaded = _load_prep_task(db, task_id)
    assert reloaded is not None
    return reloaded
