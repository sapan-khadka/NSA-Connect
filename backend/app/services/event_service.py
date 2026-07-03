from datetime import UTC, datetime

from sqlalchemy import extract, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.lib.event_photo_archive import default_show_in_photo_archive
from app.models.event import Event, EventType
from app.models.event_task import EventTask
from app.models.finance_entry import FinanceEntry
from app.schemas.event import EventCreateRequest, EventPatchRequest


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

    # Preserve financial records: unlink any finance entries from the event
    # rather than deleting them, so treasury history stays intact.
    db.execute(
        update(FinanceEntry)
        .where(FinanceEntry.event_id == event_id)
        .values(event_id=None),
    )

    # Finance entries are unlinked above. RSVPs, volunteer slots, and event tasks
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
    db.commit()
    db.refresh(event)
    return event


def list_events(
    db: Session,
    *,
    month: str | None = None,
    event_type: EventType | None = None,
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

    total = db.scalar(count_query) or 0
    events = db.scalars(
        query.order_by(Event.starts_at.asc()),
    ).all()
    return list(events), total


def list_upcoming_events(
    db: Session,
    *,
    limit: int = 50,
) -> tuple[list[Event], int]:
    now = datetime.now(UTC)
    query = select(Event).where(Event.starts_at >= now)
    count_query = select(func.count()).select_from(Event).where(Event.starts_at >= now)

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
) -> tuple[list[Event], int]:
    now = datetime.now(UTC)
    query = select(Event).where(Event.starts_at < now)
    count_query = select(func.count()).select_from(Event).where(Event.starts_at < now)

    total = db.scalar(count_query) or 0
    events = db.scalars(
        query.order_by(Event.starts_at.desc()).offset(offset).limit(limit),
    ).all()
    return list(events), total


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
