from datetime import UTC, datetime

from sqlalchemy import extract, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceEntry
from app.schemas.event import EventCreateRequest


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

    # Prep tasks are not cascade-deleted via the Event relationship, so remove
    # them explicitly (their checklist items cascade through the ORM). RSVPs and
    # volunteer slots cascade automatically when the event is deleted.
    for task in list(event.prep_tasks):
        db.delete(task)

    db.delete(event)
    db.commit()


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


def get_event_with_prep_tasks(db: Session, event_id: int) -> Event:
    from app.models.preptask import PrepTask

    event = db.scalar(
        select(Event)
        .where(Event.id == event_id)
        .options(
            selectinload(Event.prep_tasks).selectinload(PrepTask.checklist_items),
            selectinload(Event.prep_tasks).selectinload(PrepTask.group),
        ),
    )
    if event is None:
        raise EventNotFoundError
    return event


def _parse_month(month: str) -> tuple[int, int]:
    parsed = datetime.strptime(month, "%Y-%m").replace(tzinfo=UTC)
    return parsed.year, parsed.month
