from datetime import UTC, datetime

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.event import Event, EventType
from app.schemas.event import EventCreateRequest


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


def _parse_month(month: str) -> tuple[int, int]:
    parsed = datetime.strptime(month, "%Y-%m").replace(tzinfo=UTC)
    return parsed.year, parsed.month
