from datetime import UTC, datetime

from sqlalchemy import delete, extract, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.lib.event_photo_archive import default_show_in_photo_archive
from app.lib.event_visibility import apply_event_visibility_filter, event_visible_to_member
from app.models.event import Event, EventType, MeetingVisibility
from app.models.event_task import EventTask
from app.models.finance_entry import FinanceEntry
from app.models.member import Member
from app.models.notification_sent_log import NotificationSentLog
from app.schemas.event import EventCreateRequest, EventPatchRequest


class EventAccessDeniedError(Exception):
    pass


class EventNotFoundError(Exception):
    pass


def create_event(
    db: Session,
    data: EventCreateRequest,
    *,
    created_by_id: int,
) -> Event:
    event = Event(
        title=data.name,
        description=data.description,
        event_type=data.event_type,
        starts_at=data.starts_at,
        budget=data.budget,
        show_in_photo_archive=default_show_in_photo_archive(data.event_type),
        meeting_visibility=(
            data.meeting_visibility
            if data.event_type == EventType.MEETING
            else None
        ),
        created_by_id=created_by_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: int) -> None:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    task_ids = list(
        db.scalars(select(EventTask.id).where(EventTask.event_id == event_id)).all(),
    )
    log_conditions = [NotificationSentLog.event_id == event_id]
    if task_ids:
        log_conditions.append(NotificationSentLog.event_task_id.in_(task_ids))
    db.execute(delete(NotificationSentLog).where(or_(*log_conditions)))

    # Preserve financial records: unlink any finance entries from the event
    # rather than deleting them, so treasury history stays intact.
    db.execute(
        update(FinanceEntry)
        .where(FinanceEntry.event_id == event_id)
        .values(event_id=None),
    )

    # RSVPs, volunteer slots, event tasks, participant invitations, and photos
    # cascade automatically when the event is deleted.
    db.delete(event)
    db.commit()


def update_event(
    db: Session,
    event_id: int,
    data: EventPatchRequest,
) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    if data.show_in_photo_archive is not None:
        event.show_in_photo_archive = data.show_in_photo_archive
    if data.starts_at is not None:
        event.starts_at = data.starts_at
    if data.meeting_visibility is not None:
        if event.event_type != EventType.MEETING:
            raise ValueError("meeting_visibility only applies to meeting events")
        event.meeting_visibility = data.meeting_visibility
    db.commit()
    db.refresh(event)
    return event


def list_events(
    db: Session,
    *,
    month: str | None = None,
    event_type: EventType | None = None,
    viewer: Member,
) -> tuple[list[Event], int]:
    query = select(Event)
    count_query = select(func.count()).select_from(Event)

    if month is not None:
        year, month_number = _parse_month(month)
        year_filter = extract("year", Event.starts_at) == year
        month_filter = extract("month", Event.starts_at) == month_number
        query = query.where(year_filter, month_filter)
        count_query = count_query.where(year_filter, month_filter)

    if event_type is not None:
        query = query.where(Event.event_type == event_type)
        count_query = count_query.where(Event.event_type == event_type)

    query = apply_event_visibility_filter(query, viewer)
    count_query = apply_event_visibility_filter(count_query, viewer)

    total = db.scalar(count_query) or 0
    events = db.scalars(
        query.order_by(Event.starts_at.asc()),
    ).all()
    return list(events), total


def list_upcoming_events(
    db: Session,
    *,
    limit: int = 50,
    viewer: Member,
) -> tuple[list[Event], int]:
    now = datetime.now(UTC)
    query = select(Event).where(Event.starts_at >= now)
    count_query = (
        select(func.count()).select_from(Event).where(Event.starts_at >= now)
    )

    query = apply_event_visibility_filter(query, viewer)
    count_query = apply_event_visibility_filter(count_query, viewer)

    total = db.scalar(count_query) or 0
    events = db.scalars(
        query.order_by(Event.starts_at.asc()).limit(limit),
    ).all()
    return list(events), total


def list_past_events(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    viewer: Member,
) -> tuple[list[Event], int]:
    now = datetime.now(UTC)
    query = select(Event).where(Event.starts_at < now)
    count_query = select(func.count()).select_from(Event).where(Event.starts_at < now)

    query = apply_event_visibility_filter(query, viewer)
    count_query = apply_event_visibility_filter(count_query, viewer)

    total = db.scalar(count_query) or 0
    events = db.scalars(
        query.order_by(Event.starts_at.desc()).offset(offset).limit(limit),
    ).all()
    return list(events), total


def ensure_member_can_access_event(
    db: Session,
    event_id: int,
    member_id: int,
) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    member = db.get(Member, member_id)
    if member is None or not event_visible_to_member(event, member):
        raise EventNotFoundError
    return event


def get_event_with_prep_tasks_for_member(
    db: Session,
    event_id: int,
    *,
    viewer: Member,
) -> Event:
    event = get_event_with_prep_tasks(db, event_id)
    if not event_visible_to_member(event, viewer):
        raise EventNotFoundError
    return event


def get_event_with_tasks(db: Session, event_id: int) -> Event:
    event = db.scalar(
        select(Event)
        .where(Event.id == event_id)
        .options(
            selectinload(Event.event_tasks).selectinload(EventTask.checklist_items),
            selectinload(Event.event_tasks).selectinload(EventTask.group),
        ),
    )
    if event is None:
        raise EventNotFoundError
    return event


def get_event_with_prep_tasks(db: Session, event_id: int) -> Event:
    """Backward-compatible loader for checklist event tasks."""
    return get_event_with_tasks(db, event_id)


def _parse_month(month: str) -> tuple[int, int]:
    parsed = datetime.strptime(month, "%Y-%m").replace(tzinfo=UTC)
    return parsed.year, parsed.month
