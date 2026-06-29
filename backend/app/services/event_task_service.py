from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.event_task import EventTask, EventTaskStatus
from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.event_task import (
    EventTaskCreateRequest,
    EventTaskUpdateRequest,
    TaskOverviewMember,
    TaskOverviewResponse,
)
from app.services.event_service import EventNotFoundError

BOARD_ROLES = (MemberRole.BOARD, MemberRole.TREASURER, MemberRole.PRESIDENT)

# Fields that only a board member (not a plain assignee) may modify.
MANAGER_ONLY_FIELDS = frozenset({"title", "description", "assignee_id", "due_date"})


class EventTaskNotFoundError(Exception):
    pass


class EventTaskForbiddenError(Exception):
    pass


class InvalidEventTaskAssigneeError(Exception):
    """Assignee must be an approved board member or higher."""


def _validate_assignee(db: Session, assignee_id: int | None) -> None:
    if assignee_id is None:
        return
    assignee = db.get(Member, assignee_id)
    if assignee is None or assignee.status != MemberStatus.APPROVED:
        raise InvalidEventTaskAssigneeError
    if not assignee.has_role_at_least(MemberRole.BOARD):
        raise InvalidEventTaskAssigneeError


def _load_task(db: Session, task_id: int) -> EventTask | None:
    return db.scalar(
        select(EventTask)
        .where(EventTask.id == task_id)
        .options(
            selectinload(EventTask.event),
            selectinload(EventTask.assignee),
        ),
    )


def create_event_task(
    db: Session,
    event_id: int,
    data: EventTaskCreateRequest,
    *,
    created_by: Member,
) -> EventTask:
    if db.get(Event, event_id) is None:
        raise EventNotFoundError

    _validate_assignee(db, data.assignee_id)

    task = EventTask(
        event_id=event_id,
        title=data.title,
        description=data.description,
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        status=EventTaskStatus.TODO,
        created_by_id=created_by.id,
    )
    db.add(task)
    db.commit()

    reloaded = _load_task(db, task.id)
    assert reloaded is not None
    return reloaded


def list_event_tasks_for_event(db: Session, event_id: int) -> list[EventTask]:
    if db.get(Event, event_id) is None:
        raise EventNotFoundError

    return list(
        db.scalars(
            select(EventTask)
            .where(EventTask.event_id == event_id)
            .options(
                selectinload(EventTask.event),
                selectinload(EventTask.assignee),
            )
            .order_by(EventTask.created_at.asc(), EventTask.id.asc()),
        ).all(),
    )


def list_my_event_tasks(db: Session, member_id: int) -> list[EventTask]:
    return list(
        db.scalars(
            select(EventTask)
            .where(EventTask.assignee_id == member_id)
            .options(
                selectinload(EventTask.event),
                selectinload(EventTask.assignee),
            )
            .order_by(EventTask.created_at.desc(), EventTask.id.desc()),
        ).all(),
    )


def update_event_task(
    db: Session,
    task_id: int,
    data: EventTaskUpdateRequest,
    current_member: Member,
) -> EventTask:
    task = _load_task(db, task_id)
    if task is None:
        raise EventTaskNotFoundError

    is_board = current_member.has_role_at_least(MemberRole.BOARD)
    is_assignee = task.assignee_id == current_member.id
    if not (is_board or is_assignee):
        raise EventTaskForbiddenError

    updates = data.model_dump(exclude_unset=True)

    if not is_board and (MANAGER_ONLY_FIELDS & updates.keys()):
        raise EventTaskForbiddenError

    if "assignee_id" in updates:
        _validate_assignee(db, updates["assignee_id"])
        task.assignee_id = updates["assignee_id"]

    for field in ("title", "description", "due_date", "completion_note", "completion_photo_url"):
        if field in updates:
            setattr(task, field, updates[field])

    if "status" in updates:
        new_status = updates["status"]
        task.status = new_status
        if new_status == EventTaskStatus.DONE:
            task.completed_at = datetime.now(UTC)
        else:
            task.completed_at = None

    db.commit()

    reloaded = _load_task(db, task_id)
    assert reloaded is not None
    return reloaded


def delete_event_task(db: Session, task_id: int) -> None:
    task = db.get(EventTask, task_id)
    if task is None:
        raise EventTaskNotFoundError
    db.delete(task)
    db.commit()


def get_task_overview(db: Session) -> TaskOverviewResponse:
    tasks = list(
        db.scalars(
            select(EventTask)
            .options(
                selectinload(EventTask.event),
                selectinload(EventTask.assignee),
            )
            .order_by(EventTask.created_at.desc(), EventTask.id.desc()),
        ).all(),
    )

    board_members = list(
        db.scalars(
            select(Member)
            .where(Member.status == MemberStatus.APPROVED)
            .where(Member.role.in_(BOARD_ROLES))
            .order_by(Member.full_name.asc()),
        ).all(),
    )

    tasks_by_assignee: dict[int | None, list[EventTask]] = defaultdict(list)
    for task in tasks:
        tasks_by_assignee[task.assignee_id].append(task)

    members = [
        TaskOverviewMember.build(member, tasks_by_assignee.get(member.id, []))
        for member in board_members
    ]

    total_tasks = len(tasks)
    completed_tasks = sum(1 for task in tasks if task.status == EventTaskStatus.DONE)

    return TaskOverviewResponse(
        members=members,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
    )
