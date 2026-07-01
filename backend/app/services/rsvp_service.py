from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import Member, MemberRole, MemberStatus
from app.services.event_service import EventNotFoundError


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


@dataclass(frozen=True)
class EventRsvpAttendee:
    member_id: int
    full_name: str
    member_type: str
    rsvp_status: RsvpStatus


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


def _count_rsvps_by_status(db: Session, event_id: int) -> EventRsvpCounts:
    rows = db.execute(
        select(EventRsvp.status, func.count())
        .where(EventRsvp.event_id == event_id)
        .group_by(EventRsvp.status),
    ).all()
    counts = {status: count for status, count in rows}
    return EventRsvpCounts(
        going_count=counts.get(RsvpStatus.GOING, 0),
        maybe_count=counts.get(RsvpStatus.MAYBE, 0),
        not_going_count=counts.get(RsvpStatus.NOT_GOING, 0),
    )


def set_event_rsvp_status(
    db: Session,
    event_id: int,
    member_id: int,
    status: RsvpStatus,
) -> RsvpStatus:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
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

    return set_event_rsvp_status(db, event_id, member_id, RsvpStatus.GOING)


def cancel_event_rsvp(db: Session, event_id: int, member_id: int) -> None:
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


def list_event_attendees(
    db: Session,
    event_id: int,
) -> tuple[EventRsvpCounts, list[EventRsvpAttendee]]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    rows = db.execute(
        select(EventRsvp, Member)
        .join(Member, EventRsvp.member_id == Member.id)
        .where(
            EventRsvp.event_id == event_id,
            Member.status == MemberStatus.APPROVED,
        )
        .order_by(Member.full_name.asc()),
    ).all()

    attendees = [
        EventRsvpAttendee(
            member_id=member.id,
            full_name=member.full_name,
            member_type=member_type_label(member.role),
            rsvp_status=rsvp.status,
        )
        for rsvp, member in rows
    ]
    return _count_rsvps_by_status(db, event_id), attendees
