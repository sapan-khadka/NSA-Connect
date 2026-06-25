from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.event_rsvp import EventRsvp
from app.services.event_service import EventNotFoundError


class EventNotUpcomingError(Exception):
    pass


class AlreadyRsvpedError(Exception):
    pass


class NotRsvpedError(Exception):
    pass


def get_event_rsvp_status(
    db: Session,
    event_id: int,
    member_id: int,
) -> tuple[int, bool]:
    rsvp_count = db.scalar(
        select(func.count())
        .select_from(EventRsvp)
        .where(EventRsvp.event_id == event_id),
    ) or 0
    has_rsvped = db.scalar(
        select(EventRsvp.id).where(
            EventRsvp.event_id == event_id,
            EventRsvp.member_id == member_id,
        ),
    ) is not None
    return rsvp_count, has_rsvped


def rsvp_to_event(db: Session, event_id: int, member_id: int) -> tuple[int, bool]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    if not event.is_upcoming:
        raise EventNotUpcomingError

    existing = db.scalar(
        select(EventRsvp.id).where(
            EventRsvp.event_id == event_id,
            EventRsvp.member_id == member_id,
        ),
    )
    if existing is not None:
        raise AlreadyRsvpedError

    db.add(
        EventRsvp(
            event_id=event_id,
            member_id=member_id,
            created_at=datetime.now(UTC),
        ),
    )
    db.commit()
    return get_event_rsvp_status(db, event_id, member_id)


def cancel_event_rsvp(db: Session, event_id: int, member_id: int) -> tuple[int, bool]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    rsvp = db.scalar(
        select(EventRsvp).where(
            EventRsvp.event_id == event_id,
            EventRsvp.member_id == member_id,
        ),
    )
    if rsvp is None:
        raise NotRsvpedError

    db.delete(rsvp)
    db.commit()
    return get_event_rsvp_status(db, event_id, member_id)
