from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.member import Member, MemberStatus
from app.models.preptask import PrepTask, PrepTaskGroup, checklist_items_from_group
from app.schemas.preptask import PrepTaskCreateRequest
from app.services.event_service import EventNotFoundError


class PrepTaskGroupNotFoundError(Exception):
    pass


class InvalidAssigneeError(Exception):
    pass


class InvalidPrepTaskDueDateError(Exception):
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
    if assignee_id is not None:
        assignee = db.get(Member, assignee_id)
        if assignee is None or assignee.status != MemberStatus.APPROVED:
            raise InvalidAssigneeError

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
