import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_frontend_url
from app.models.event import Event
from app.models.event_checkin import EventCheckIn
from app.models.event_guest_checkin import EventGuestCheckIn, GuestAffiliationType
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import Member, MemberStatus
from app.services.event_service import EventNotFoundError

CHECKIN_EARLY_BUFFER = timedelta(hours=1)
CHECKIN_LATE_BUFFER_AFTER_END = timedelta(hours=2)
CHECKIN_LATE_BUFFER_AFTER_START_NO_END = timedelta(hours=4)


class InvalidCheckInTokenError(Exception):
    pass


class CheckInWindowClosedError(Exception):
    pass


class CheckInResultStatus(StrEnum):
    CHECKED_IN = "checked_in"
    ALREADY_CHECKED_IN = "already_checked_in"


@dataclass(frozen=True)
class CheckInResult:
    status: CheckInResultStatus
    event: Event
    checked_in_at: datetime


@dataclass(frozen=True)
class GuestCheckInResult:
    event: Event
    guest_name: str
    checked_in_at: datetime


@dataclass(frozen=True)
class AttendanceListItem:
    kind: str
    full_name: str
    checked_in_at: datetime
    member_id: int | None = None
    guest_id: int | None = None
    email: str | None = None
    affiliation_type: str | None = None
    related_member_name: str | None = None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def get_checkin_window(event: Event) -> tuple[datetime, datetime]:
    starts_at = _as_utc(event.starts_at)
    window_start = starts_at - CHECKIN_EARLY_BUFFER
    if event.ends_at is not None:
        window_end = _as_utc(event.ends_at) + CHECKIN_LATE_BUFFER_AFTER_END
    else:
        window_end = starts_at + CHECKIN_LATE_BUFFER_AFTER_START_NO_END
    return window_start, window_end


def is_checkin_window_open(
    event: Event,
    *,
    as_of: datetime | None = None,
) -> bool:
    now = _as_utc(as_of or datetime.now(UTC))
    window_start, window_end = get_checkin_window(event)
    return window_start <= now <= window_end


def build_checkin_url(event_id: int, token: str) -> str:
    base = get_frontend_url()
    return f"{base}/events/{event_id}/checkin?token={token}"


def ensure_checkin_token(db: Session, event: Event) -> str:
    if event.checkin_token:
        return event.checkin_token

    event.checkin_token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(event)
    return event.checkin_token


def regenerate_checkin_token(db: Session, event: Event) -> str:
    event.checkin_token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(event)
    return event.checkin_token


def get_checkin_qr_info(db: Session, event_id: int) -> tuple[Event, str, str]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    token = ensure_checkin_token(db, event)
    return event, token, build_checkin_url(event_id, token)


def _get_event_for_checkin(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    return event


def _validate_checkin_token_and_window(
    event: Event,
    token: str,
    *,
    as_of: datetime | None = None,
) -> None:
    if not event.checkin_token or token != event.checkin_token:
        raise InvalidCheckInTokenError

    if not is_checkin_window_open(event, as_of=as_of):
        raise CheckInWindowClosedError


def list_event_checkins(db: Session, event_id: int) -> list[AttendanceListItem]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    member_rows = db.scalars(
        select(EventCheckIn)
        .where(EventCheckIn.event_id == event_id)
        .options(joinedload(EventCheckIn.member))
        .order_by(EventCheckIn.checked_in_at.asc()),
    ).all()

    guest_rows = db.scalars(
        select(EventGuestCheckIn)
        .where(EventGuestCheckIn.event_id == event_id)
        .order_by(EventGuestCheckIn.checked_in_at.asc()),
    ).all()

    items: list[AttendanceListItem] = [
        AttendanceListItem(
            kind="member",
            member_id=row.member_id,
            full_name=row.member.full_name,
            email=row.member.email,
            checked_in_at=_as_utc(row.checked_in_at),
        )
        for row in member_rows
    ]
    items.extend(
        AttendanceListItem(
            kind="guest",
            guest_id=row.id,
            full_name=row.guest_name,
            affiliation_type=(
                row.affiliation_type.value if row.affiliation_type is not None else None
            ),
            related_member_name=row.related_member_name,
            checked_in_at=_as_utc(row.checked_in_at),
        )
        for row in guest_rows
    )
    items.sort(key=lambda item: item.checked_in_at)
    return items


def perform_checkin(
    db: Session,
    *,
    event_id: int,
    member_id: int,
    token: str,
    as_of: datetime | None = None,
) -> CheckInResult:
    event = _get_event_for_checkin(db, event_id)
    _validate_checkin_token_and_window(event, token, as_of=as_of)

    member = db.get(Member, member_id)
    if member is None or member.status != MemberStatus.APPROVED:
        raise InvalidCheckInTokenError

    existing = db.scalar(
        select(EventCheckIn).where(
            EventCheckIn.event_id == event_id,
            EventCheckIn.member_id == member_id,
        ),
    )
    if existing is not None:
        return CheckInResult(
            status=CheckInResultStatus.ALREADY_CHECKED_IN,
            event=event,
            checked_in_at=_as_utc(existing.checked_in_at),
        )

    checked_in_at = _as_utc(as_of or datetime.now(UTC))
    db.add(
        EventCheckIn(
            event_id=event_id,
            member_id=member_id,
            checked_in_at=checked_in_at,
        ),
    )
    db.commit()

    return CheckInResult(
        status=CheckInResultStatus.CHECKED_IN,
        event=event,
        checked_in_at=checked_in_at,
    )


def perform_guest_checkin(
    db: Session,
    *,
    event_id: int,
    token: str,
    guest_name: str,
    affiliation_type: GuestAffiliationType | None = None,
    related_member_name: str | None = None,
    as_of: datetime | None = None,
) -> GuestCheckInResult:
    event = _get_event_for_checkin(db, event_id)
    _validate_checkin_token_and_window(event, token, as_of=as_of)

    checked_in_at = _as_utc(as_of or datetime.now(UTC))
    normalized_name = guest_name.strip()
    normalized_related_member_name = (
        related_member_name.strip() if related_member_name else None
    )
    if normalized_related_member_name == "":
        normalized_related_member_name = None

    db.add(
        EventGuestCheckIn(
            event_id=event_id,
            guest_name=normalized_name,
            affiliation_type=affiliation_type,
            related_member_name=normalized_related_member_name,
            checked_in_at=checked_in_at,
        ),
    )
    db.commit()

    return GuestCheckInResult(
        event=event,
        guest_name=normalized_name,
        checked_in_at=checked_in_at,
    )


def get_attendance_summary(db: Session, event_id: int) -> dict:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    checkins = {
        row.member_id: row
        for row in db.scalars(
            select(EventCheckIn)
            .where(EventCheckIn.event_id == event_id)
            .options(joinedload(EventCheckIn.member)),
        ).all()
    }

    rsvps = {
        row.member_id: row.status
        for row in db.scalars(
            select(EventRsvp).where(EventRsvp.event_id == event_id)
        ).all()
    }

    going_attended: list[dict] = []
    going_no_show: list[dict] = []
    walk_ins: list[dict] = []
    not_going: list[dict] = []

    for member_id, status in rsvps.items():
        checkin = checkins.get(member_id)
        member = checkin.member if checkin else db.get(Member, member_id)
        if member is None:
            continue

        entry = {
            "member_id": member.id,
            "full_name": member.full_name,
            "checked_in_at": checkin.checked_in_at if checkin else None,
        }

        if status == RsvpStatus.GOING:
            if checkin is not None:
                going_attended.append(entry)
            else:
                going_no_show.append(entry)
        elif status == RsvpStatus.NOT_GOING:
            not_going.append(entry)

    for member_id, checkin in checkins.items():
        status = rsvps.get(member_id)
        if status == RsvpStatus.GOING:
            continue

        walk_ins.append(
            {
                "member_id": checkin.member_id,
                "full_name": checkin.member.full_name,
                "checked_in_at": checkin.checked_in_at,
            },
        )

    walk_ins.sort(key=lambda item: item["full_name"].lower())
    going_attended.sort(key=lambda item: item["full_name"].lower())
    going_no_show.sort(key=lambda item: item["full_name"].lower())
    not_going.sort(key=lambda item: item["full_name"].lower())

    guest_count = len(
        db.scalars(
            select(EventGuestCheckIn).where(EventGuestCheckIn.event_id == event_id),
        ).all(),
    )

    return {
        "event_id": event.id,
        "event_name": event.title,
        "going_attended": {"count": len(going_attended), "members": going_attended},
        "going_no_show": {"count": len(going_no_show), "members": going_no_show},
        "walk_ins": {"count": len(walk_ins), "members": walk_ins},
        "not_going": {"count": len(not_going), "members": not_going},
        "guests_checked_in": {"count": guest_count},
    }
