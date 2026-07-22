import logging
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.event_task import (
    EventTask,
    EventTaskKind,
    EventTaskStatus,
    checklist_items_from_group,
    checklist_items_from_labels,
    sync_checklist_status,
)
from app.models.event_volunteer_signup import EventVolunteerSignup
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.models.preptask import PrepTaskGroup
from app.schemas.event_task import (
    ChecklistEventTaskCreateRequest,
    EventTaskCreateRequest,
    EventTaskUpdateRequest,
    TaskOverviewMember,
    TaskOverviewResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.notification_scan_service import notify_task_assigned_if_enabled
from app.services.organization_context import get_default_organization_id

logger = logging.getLogger(__name__)

BOARD_ROLES = (MemberRole.BOARD, MemberRole.TREASURER, MemberRole.PRESIDENT)

MANAGER_ONLY_FIELDS = frozenset({"title", "description", "assignee_id", "due_date"})


class EventTaskNotFoundError(Exception):
    pass


class EventTaskForbiddenError(Exception):
    pass


class InvalidEventTaskAssigneeError(Exception):
    """Assignee must be an approved member (board+ for checklist tasks)."""


class PrepTaskGroupNotFoundError(Exception):
    pass


class InvalidPrepTaskDueDateError(Exception):
    pass


class EventTaskChecklistItemNotFoundError(Exception):
    pass


class EventTaskCreationClosedError(Exception):
    """Raised when an event has ended and new tasks can no longer be added."""


def is_task_manager(member: Member) -> bool:
    return member.role == MemberRole.PRESIDENT or member.position in {
        MemberPosition.VICE_PRESIDENT,
        MemberPosition.EVENT_MANAGER,
    }


def _validate_assignee(
    db: Session,
    assignee_id: int | None,
    *,
    require_board_role: bool = True,
    event_id: int | None = None,
) -> None:
    if assignee_id is None:
        return
    assignee = db.get(Member, assignee_id)
    if assignee is None or assignee.status != MemberStatus.APPROVED:
        raise InvalidEventTaskAssigneeError
    if require_board_role:
        if not assignee.has_role_at_least(MemberRole.BOARD):
            raise InvalidEventTaskAssigneeError
        return
    # Simple tasks: board+ or approved volunteer for this event.
    if assignee.has_role_at_least(MemberRole.BOARD):
        return
    if event_id is None:
        raise InvalidEventTaskAssigneeError
    from app.services.event_volunteer_signup_service import (
        member_has_approved_volunteer_signup,
    )

    if not member_has_approved_volunteer_signup(
        db,
        event_id=event_id,
        member_id=assignee_id,
    ):
        raise InvalidEventTaskAssigneeError


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _validate_checklist_due_date(due_date: datetime, event_starts_at: datetime) -> None:
    due_date = _as_utc(due_date)
    event_starts_at = _as_utc(event_starts_at)
    now = datetime.now(UTC)
    if due_date <= now:
        raise InvalidPrepTaskDueDateError("Task due date must be in the future")
    if due_date >= event_starts_at:
        raise InvalidPrepTaskDueDateError(
            "Task due date must be before the event starts",
        )


def _get_or_create_group(db: Session, group_name: str) -> PrepTaskGroup:
    group = db.scalar(
        select(PrepTaskGroup).where(PrepTaskGroup.group_name == group_name),
    )
    if group is None:
        group = PrepTaskGroup(
            group_name=group_name,
            organization_id=get_default_organization_id(db),
        )
        db.add(group)
        db.flush()
    return group


def _load_task(db: Session, task_id: int) -> EventTask | None:
    return db.scalar(
        select(EventTask)
        .where(EventTask.id == task_id)
        .options(
            selectinload(EventTask.event),
            selectinload(EventTask.assignee),
            selectinload(EventTask.created_by),
            selectinload(EventTask.group),
            selectinload(EventTask.checklist_items),
        ),
    )


def _load_tasks_for_event(db: Session, event_id: int) -> list[EventTask]:
    return list(
        db.scalars(
            select(EventTask)
            .where(EventTask.event_id == event_id)
            .options(
                selectinload(EventTask.event),
                selectinload(EventTask.assignee),
                selectinload(EventTask.group),
                selectinload(EventTask.checklist_items),
            )
            .order_by(EventTask.due_date.asc().nullslast(), EventTask.created_at.asc()),
        ).all(),
    )


def _maybe_notify_new_assignee(
    db: Session,
    task: EventTask,
    *,
    assignee_id: int | None,
) -> None:
    if assignee_id is None:
        return

    assignee = db.get(Member, assignee_id)
    if assignee is None:
        return

    assigner_name = task.created_by.full_name if task.created_by else None

    try:
        notify_task_assigned_if_enabled(
            db,
            task=task,
            assignee=assignee,
            assigner_name=assigner_name,
        )
    except Exception:
        logger.exception(
            "Task assigned notification failed task_id=%s assignee_id=%s email=%s",
            task.id,
            assignee.id,
            assignee.email,
        )


def create_simple_event_task(
    db: Session,
    event_id: int,
    data: EventTaskCreateRequest,
    *,
    created_by: Member,
) -> EventTask:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    if not event.is_upcoming:
        raise EventTaskCreationClosedError

    _validate_assignee(
        db,
        data.assignee_id,
        require_board_role=False,
        event_id=event_id,
    )

    task = EventTask(
        event_id=event_id,
        task_kind=EventTaskKind.SIMPLE,
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
    if data.assignee_id is not None:
        _maybe_notify_new_assignee(db, reloaded, assignee_id=data.assignee_id)
    return reloaded


def create_checklist_event_task(
    db: Session,
    event_id: int,
    data: ChecklistEventTaskCreateRequest,
    *,
    created_by: Member | None = None,
) -> EventTask:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    _validate_checklist_due_date(data.due_date, event.starts_at)
    _validate_assignee(db, data.assignee_id)

    if data.checklist_items:
        group = _get_or_create_group(db, data.group_name)
        checklist_items = checklist_items_from_labels(data.checklist_items)
    else:
        group = db.scalar(
            select(PrepTaskGroup)
            .where(PrepTaskGroup.group_name == data.group_name)
            .options(selectinload(PrepTaskGroup.items)),
        )
        if group is None:
            raise PrepTaskGroupNotFoundError
        checklist_items = checklist_items_from_group(group)

    task = EventTask(
        event_id=event_id,
        task_kind=EventTaskKind.CHECKLIST,
        title=data.group_name,
        description="",
        group_id=group.id,
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        status=EventTaskStatus.TODO,
        checklist_items=checklist_items,
        created_by_id=created_by.id if created_by is not None else None,
    )
    sync_checklist_status(task)
    db.add(task)
    db.commit()

    reloaded = _load_task(db, task.id)
    assert reloaded is not None
    if data.assignee_id is not None:
        _maybe_notify_new_assignee(db, reloaded, assignee_id=data.assignee_id)
    return reloaded


def list_event_tasks_for_event(db: Session, event_id: int) -> list[EventTask]:
    if db.get(Event, event_id) is None:
        raise EventNotFoundError
    return _load_tasks_for_event(db, event_id)


def list_checklist_tasks_for_event(db: Session, event_id: int) -> list[EventTask]:
    return [
        task
        for task in list_event_tasks_for_event(db, event_id)
        if task.task_kind == EventTaskKind.CHECKLIST
    ]


def list_my_event_tasks(db: Session, member_id: int) -> list[EventTask]:
    return list(
        db.scalars(
            select(EventTask)
            .where(EventTask.assignee_id == member_id)
            .options(
                selectinload(EventTask.event),
                selectinload(EventTask.assignee),
                selectinload(EventTask.group),
                selectinload(EventTask.checklist_items),
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
    previous_assignee_id = task.assignee_id

    if not is_board and (MANAGER_ONLY_FIELDS & updates.keys()):
        raise EventTaskForbiddenError

    if "assignee_id" in updates:
        require_board_role = task.task_kind != EventTaskKind.SIMPLE
        _validate_assignee(
            db,
            updates["assignee_id"],
            require_board_role=require_board_role,
            event_id=task.event_id,
        )
        task.assignee_id = updates["assignee_id"]

    for field in (
        "title",
        "description",
        "due_date",
        "completion_note",
        "completion_photo_url",
    ):
        if field in updates:
            setattr(task, field, updates[field])

    if "is_complete" in updates and task.task_kind == EventTaskKind.CHECKLIST:
        completed = updates["is_complete"]
        for item in task.checklist_items:
            item.is_completed = completed
        sync_checklist_status(task)

    if "status" in updates and task.task_kind == EventTaskKind.SIMPLE:
        new_status = updates["status"]
        task.status = new_status
        if new_status == EventTaskStatus.DONE:
            task.completed_at = datetime.now(UTC)
        else:
            task.completed_at = None

    db.commit()

    reloaded = _load_task(db, task_id)
    assert reloaded is not None
    if (
        "assignee_id" in updates
        and reloaded.assignee_id is not None
        and reloaded.assignee_id != previous_assignee_id
    ):
        _maybe_notify_new_assignee(db, reloaded, assignee_id=reloaded.assignee_id)
    return reloaded


def update_event_task_checklist_item(
    db: Session,
    task_id: int,
    item_id: int,
    *,
    is_completed: bool,
    current_member: Member,
) -> EventTask:
    task = _load_task(db, task_id)
    if task is None:
        raise EventTaskNotFoundError

    if task.task_kind != EventTaskKind.CHECKLIST:
        raise EventTaskNotFoundError

    is_board = current_member.has_role_at_least(MemberRole.BOARD)
    is_assignee = task.assignee_id == current_member.id
    if not (is_board or is_assignee):
        raise EventTaskForbiddenError

    checklist_item = next(
        (item for item in task.checklist_items if item.id == item_id),
        None,
    )
    if checklist_item is None:
        raise EventTaskChecklistItemNotFoundError

    checklist_item.is_completed = is_completed
    sync_checklist_status(task)
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
                selectinload(EventTask.group),
                selectinload(EventTask.checklist_items),
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

    from app.models.event_volunteer_signup import EventVolunteerSignupStatus

    volunteer_signup_pairs = {
        (signup.member_id, signup.event_id)
        for signup in db.scalars(
            select(EventVolunteerSignup).where(
                EventVolunteerSignup.status == EventVolunteerSignupStatus.APPROVED
            )
        ).all()
    }

    board_member_ids = {member.id for member in board_members}
    volunteer_ids = {
        assignee_id
        for assignee_id in tasks_by_assignee
        if assignee_id is not None and assignee_id not in board_member_ids
    }

    volunteer_members: list[Member] = []
    if volunteer_ids:
        volunteer_members = list(
            db.scalars(
                select(Member)
                .where(Member.id.in_(volunteer_ids))
                .order_by(Member.full_name.asc()),
            ).all(),
        )

    members = [
        TaskOverviewMember.build(
            member,
            tasks_by_assignee.get(member.id, []),
            volunteer_signup_pairs=volunteer_signup_pairs,
        )
        for member in [*board_members, *volunteer_members]
    ]

    total_tasks = len(tasks)
    completed_tasks = sum(1 for task in tasks if task.status == EventTaskStatus.DONE)

    return TaskOverviewResponse(
        members=members,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
    )
