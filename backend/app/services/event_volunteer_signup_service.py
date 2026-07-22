from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.event_volunteer_signup import (
    EventVolunteerSignup,
    EventVolunteerSignupStatus,
)
from app.models.member import Member
from app.schemas.event_volunteer_signup import (
    EventVolunteerSignupCreateRequest,
    EventVolunteerSignupMemberResponse,
    EventVolunteerSignupResponse,
)
from app.services.event_service import (
    EventNotFoundError,
    ensure_member_can_access_event,
)
from app.services.rsvp_service import EventNotUpcomingError


class NotVolunteeredError(Exception):
    pass


class VolunteerSignupNotFoundError(Exception):
    pass


class VolunteerSignupNotPendingError(Exception):
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


def member_has_approved_volunteer_signup(
    db: Session,
    *,
    event_id: int,
    member_id: int,
) -> bool:
    signup = get_member_volunteer_signup(
        db,
        event_id=event_id,
        member_id=member_id,
    )
    return (
        signup is not None
        and signup.status == EventVolunteerSignupStatus.APPROVED
    )


def volunteer_for_event(
    db: Session,
    *,
    event_id: int,
    member_id: int,
    data: EventVolunteerSignupCreateRequest,
) -> EventVolunteerSignup:
    ensure_member_can_access_event(db, event_id, member_id)
    event = db.get(Event, event_id)
    assert event is not None
    _ensure_event_is_upcoming(event)

    note = _normalize_note(data.note)
    existing = get_member_volunteer_signup(db, event_id=event_id, member_id=member_id)
    if existing is not None:
        existing.note = note
        # Rejected volunteers can re-request; resets to pending for review.
        if existing.status == EventVolunteerSignupStatus.REJECTED:
            existing.status = EventVolunteerSignupStatus.PENDING
            existing.reviewed_at = None
            existing.reviewed_by_id = None
            db.commit()
            db.refresh(existing)
            _notify_volunteer_request(db, event=event, signup=existing)
            return existing
        db.commit()
        db.refresh(existing)
        return existing

    signup = EventVolunteerSignup(
        event_id=event_id,
        member_id=member_id,
        note=note,
        status=EventVolunteerSignupStatus.PENDING,
        created_at=datetime.now(UTC),
    )
    db.add(signup)
    db.commit()
    db.refresh(signup)
    _notify_volunteer_request(db, event=event, signup=signup)
    return signup


def _notify_volunteer_request(
    db: Session,
    *,
    event: Event,
    signup: EventVolunteerSignup,
) -> None:
    from app.services.inbox_notification_service import (
        notify_task_managers_of_volunteer_signup,
    )

    member = db.get(Member, signup.member_id)
    if member is None:
        return
    notify_task_managers_of_volunteer_signup(
        db,
        event=event,
        volunteer=member,
        signup_id=signup.id,
    )


def withdraw_volunteer_signup(
    db: Session,
    *,
    event_id: int,
    member_id: int,
) -> None:
    ensure_member_can_access_event(db, event_id, member_id)
    event = db.get(Event, event_id)
    assert event is not None
    _ensure_event_is_upcoming(event)

    signup = get_member_volunteer_signup(db, event_id=event_id, member_id=member_id)
    if signup is None:
        raise NotVolunteeredError

    db.delete(signup)
    db.commit()


def review_volunteer_signup(
    db: Session,
    *,
    event_id: int,
    signup_id: int,
    status: EventVolunteerSignupStatus,
    reviewer: Member,
) -> EventVolunteerSignup:
    if status not in {
        EventVolunteerSignupStatus.APPROVED,
        EventVolunteerSignupStatus.REJECTED,
    }:
        raise VolunteerSignupNotPendingError

    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    signup = db.scalar(
        select(EventVolunteerSignup)
        .where(
            EventVolunteerSignup.id == signup_id,
            EventVolunteerSignup.event_id == event_id,
        )
        .options(selectinload(EventVolunteerSignup.member)),
    )
    if signup is None:
        raise VolunteerSignupNotFoundError
    if signup.status != EventVolunteerSignupStatus.PENDING:
        raise VolunteerSignupNotPendingError

    signup.status = status
    signup.reviewed_at = datetime.now(UTC)
    signup.reviewed_by_id = reviewer.id
    db.commit()

    from app.services.inbox_notification_service import (
        notify_volunteer_signup_reviewed,
    )

    notify_volunteer_signup_reviewed(
        db,
        event=event,
        signup=signup,
        approved=status == EventVolunteerSignupStatus.APPROVED,
    )

    reloaded = db.scalar(
        select(EventVolunteerSignup)
        .where(EventVolunteerSignup.id == signup_id)
        .options(selectinload(EventVolunteerSignup.member)),
    )
    assert reloaded is not None
    return reloaded


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
            status=row.status,
            created_at=row.created_at,
            reviewed_at=row.reviewed_at,
        )
        for row in rows
    ]


def to_member_response(signup: EventVolunteerSignup) -> EventVolunteerSignupResponse:
    return EventVolunteerSignupResponse(
        id=signup.id,
        event_id=signup.event_id,
        note=signup.note,
        status=signup.status,
        created_at=signup.created_at,
        reviewed_at=signup.reviewed_at,
    )
