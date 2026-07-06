from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.event_volunteer_signup import EventVolunteerSignup
from app.schemas.event_volunteer_signup import (
    EventVolunteerSignupCreateRequest,
    EventVolunteerSignupMemberResponse,
    EventVolunteerSignupResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.rsvp_service import EventNotUpcomingError


class NotVolunteeredError(Exception):
    pass


def _normalize_note(note: str | None) -> str | None:
    if note is None:
        return None
    trimmed = note.strip()
    return trimmed or None


def _ensure_event_is_upcoming(event: Event) -> None:
    if not event.is_upcoming:
        raise EventNotUpcomingError


def get_member_volunteer_signup(
    db: Session,
    *,
    event_id: int,
    member_id: int,
) -> EventVolunteerSignup | None:
    return db.scalar(
        select(EventVolunteerSignup).where(
            EventVolunteerSignup.event_id == event_id,
            EventVolunteerSignup.member_id == member_id,
        ),
    )


def volunteer_for_event(
    db: Session,
    *,
    event_id: int,
    member_id: int,
    data: EventVolunteerSignupCreateRequest,
) -> EventVolunteerSignup:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    _ensure_event_is_upcoming(event)

    note = _normalize_note(data.note)
    existing = get_member_volunteer_signup(db, event_id=event_id, member_id=member_id)
    if existing is not None:
        existing.note = note
        db.commit()
        db.refresh(existing)
        return existing

    signup = EventVolunteerSignup(
        event_id=event_id,
        member_id=member_id,
        note=note,
        created_at=datetime.now(UTC),
    )
    db.add(signup)
    db.commit()
    db.refresh(signup)
    return signup


def withdraw_volunteer_signup(
    db: Session,
    *,
    event_id: int,
    member_id: int,
) -> None:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    _ensure_event_is_upcoming(event)

    signup = get_member_volunteer_signup(db, event_id=event_id, member_id=member_id)
    if signup is None:
        raise NotVolunteeredError

    db.delete(signup)
    db.commit()


def list_event_volunteer_signups(
    db: Session,
    event_id: int,
) -> list[EventVolunteerSignupMemberResponse]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    rows = db.scalars(
        select(EventVolunteerSignup)
        .where(EventVolunteerSignup.event_id == event_id)
        .options(selectinload(EventVolunteerSignup.member))
        .order_by(EventVolunteerSignup.created_at.asc()),
    ).all()

    return [
        EventVolunteerSignupMemberResponse(
            id=row.id,
            member_id=row.member_id,
            full_name=row.member.full_name,
            note=row.note,
            created_at=row.created_at,
        )
        for row in rows
    ]


def to_member_response(signup: EventVolunteerSignup) -> EventVolunteerSignupResponse:
    return EventVolunteerSignupResponse(
        id=signup.id,
        event_id=signup.event_id,
        note=signup.note,
        created_at=signup.created_at,
    )
