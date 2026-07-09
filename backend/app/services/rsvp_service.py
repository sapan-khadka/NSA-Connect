from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import Member, MemberRole, MemberStatus
from app.services.event_service import (
    EventNotFoundError,
    ensure_member_can_access_event,
)


class EventNotUpcomingError(Exception):
    pass


class AlreadyRsvpedError(Exception):
    pass


class NotRsvpedError(Exception):
    pass


@dataclass(frozen=True)
class EventRsvpCounts:
    going_count: int
    maybe_count: int
    not_going_count: int
    no_response_count: int


@dataclass(frozen=True)
class EventRsvpAttendee:
    member_id: int
    full_name: str
    member_type: str
    rsvp_status: RsvpStatus | None


def member_type_label(role: MemberRole) -> str:
    if role.is_at_least(MemberRole.BOARD):
        return "Board member"
    return "General member"


def get_member_rsvp_status(
    db: Session,
    event_id: int,
    member_id: int,
) -> RsvpStatus | None:
    return db.scalar(
        select(EventRsvp.status).where(
            EventRsvp.event_id == event_id,
            EventRsvp.member_id == member_id,
        ),
    )


def set_event_rsvp_status(
    db: Session,
    event_id: int,
    member_id: int,
    status: RsvpStatus,
) -> RsvpStatus:
    ensure_member_can_access_event(db, event_id, member_id)
    event = db.get(Event, event_id)
    assert event is not None
    if not event.is_upcoming:
        raise EventNotUpcomingError

    now = datetime.now(UTC)
    existing = db.scalar(
        select(EventRsvp).where(
            EventRsvp.event_id == event_id,
            EventRsvp.member_id == member_id,
        ),
    )

    if existing is None:
        db.add(
            EventRsvp(
                event_id=event_id,
                member_id=member_id,
                status=status,
                created_at=now,
                updated_at=now,
            ),
        )
    else:
        existing.status = status
        existing.updated_at = now

    db.commit()
    return status


def rsvp_to_event(db: Session, event_id: int, member_id: int) -> RsvpStatus:
    ensure_member_can_access_event(db, event_id, member_id)
    event = db.get(Event, event_id)
    assert event is not None
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

    return set_event_rsvp_status(db, event_id, member_id, RsvpStatus.GOING)


def cancel_event_rsvp(db: Session, event_id: int, member_id: int) -> None:
    ensure_member_can_access_event(db, event_id, member_id)

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


def list_event_attendees(
    db: Session,
    event_id: int,
) -> tuple[EventRsvpCounts, list[EventRsvpAttendee]]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    rows = db.execute(
        select(Member, EventRsvp.status)
        .outerjoin(
            EventRsvp,
            (EventRsvp.member_id == Member.id) & (EventRsvp.event_id == event_id),
        )
        .where(Member.status == MemberStatus.APPROVED)
        .order_by(Member.full_name.asc()),
    ).all()

    going_count = 0
    maybe_count = 0
    not_going_count = 0
    no_response_count = 0
    attendees: list[EventRsvpAttendee] = []

    for member, status in rows:
        if status is None:
            no_response_count += 1
        elif status == RsvpStatus.GOING:
            going_count += 1
        elif status == RsvpStatus.MAYBE:
            maybe_count += 1
        elif status == RsvpStatus.NOT_GOING:
            not_going_count += 1

        attendees.append(
            EventRsvpAttendee(
                member_id=member.id,
                full_name=member.full_name,
                member_type=member_type_label(member.role),
                rsvp_status=status,
            )
        )

    counts = EventRsvpCounts(
        going_count=going_count,
        maybe_count=maybe_count,
        not_going_count=not_going_count,
        no_response_count=no_response_count,
    )
    return counts, attendees
