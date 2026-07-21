from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.volunteer import VolunteerSignup, VolunteerSlot
from app.schemas.volunteer import (
    MemberVolunteerSignupResponse,
    VolunteerSlotCreateRequest,
    VolunteerSlotPatchRequest,
)
from app.services.event_service import (
    EventNotFoundError,
    ensure_member_can_access_event,
)


class VolunteerSlotNotFoundError(Exception):
    pass


class VolunteerSlotFullError(Exception):
    pass


class AlreadySignedUpError(Exception):
    pass


class NotSignedUpError(Exception):
    pass


class VolunteerSlotCapacityTooLowError(Exception):
    pass


def _get_slot_with_signups(db: Session, slot_id: int) -> VolunteerSlot | None:
    return db.scalar(
        select(VolunteerSlot)
        .where(VolunteerSlot.id == slot_id)
        .options(
            selectinload(VolunteerSlot.signups).selectinload(VolunteerSignup.member),
            selectinload(VolunteerSlot.event),
        ),
    )


def list_volunteer_slots_for_event(
    db: Session,
    event_id: int,
) -> list[VolunteerSlot]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    return list(
        db.scalars(
            select(VolunteerSlot)
            .where(VolunteerSlot.event_id == event_id)
            .options(
                selectinload(VolunteerSlot.signups).selectinload(
                    VolunteerSignup.member
                ),
            )
            .order_by(VolunteerSlot.created_at.asc()),
        ).all(),
    )


def create_volunteer_slot_for_event(
    db: Session,
    event_id: int,
    data: VolunteerSlotCreateRequest,
) -> VolunteerSlot:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    slot = VolunteerSlot(
        event_id=event_id,
        title=data.task_name,
        description=(data.description or "").strip(),
        capacity=data.max_signup_count,
        created_at=datetime.now(UTC),
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _get_slot_with_signups(db, slot.id) or slot


def update_volunteer_slot(
    db: Session,
    slot_id: int,
    data: VolunteerSlotPatchRequest,
) -> VolunteerSlot:
    slot = _get_slot_with_signups(db, slot_id)
    if slot is None:
        raise VolunteerSlotNotFoundError

    if data.task_name is not None:
        slot.title = data.task_name
    if "description" in data.model_fields_set:
        slot.description = (data.description or "").strip()
    if data.max_signup_count is not None:
        if data.max_signup_count < slot.signup_count:
            raise VolunteerSlotCapacityTooLowError
        slot.capacity = data.max_signup_count

    db.commit()
    return _get_slot_with_signups(db, slot_id) or slot


def delete_volunteer_slot(db: Session, slot_id: int) -> None:
    slot = db.get(VolunteerSlot, slot_id)
    if slot is None:
        raise VolunteerSlotNotFoundError
    db.delete(slot)
    db.commit()


def signup_for_volunteer_slot(
    db: Session,
    slot_id: int,
    member_id: int,
) -> tuple[VolunteerSignup, VolunteerSlot]:
    slot = _get_slot_with_signups(db, slot_id)
    if slot is None:
        raise VolunteerSlotNotFoundError

    ensure_member_can_access_event(db, slot.event_id, member_id)

    existing = db.scalar(
        select(VolunteerSignup.id).where(
            VolunteerSignup.slot_id == slot_id,
            VolunteerSignup.member_id == member_id,
        ),
    )
    if existing is not None:
        raise AlreadySignedUpError

    signup_count = (
        db.scalar(
            select(func.count())
            .select_from(VolunteerSignup)
            .where(VolunteerSignup.slot_id == slot_id),
        )
        or 0
    )
    if signup_count >= slot.capacity:
        raise VolunteerSlotFullError

    signup = VolunteerSignup(
        slot_id=slot_id,
        member_id=member_id,
        created_at=datetime.now(UTC),
    )
    db.add(signup)
    db.commit()
    db.refresh(signup)

    slot = _get_slot_with_signups(db, slot_id)
    assert slot is not None
    return signup, slot


def withdraw_from_volunteer_slot(
    db: Session,
    slot_id: int,
    member_id: int,
) -> VolunteerSlot:
    slot = _get_slot_with_signups(db, slot_id)
    if slot is None:
        raise VolunteerSlotNotFoundError

    ensure_member_can_access_event(db, slot.event_id, member_id)

    signup = db.scalar(
        select(VolunteerSignup).where(
            VolunteerSignup.slot_id == slot_id,
            VolunteerSignup.member_id == member_id,
        ),
    )
    if signup is None:
        raise NotSignedUpError

    db.delete(signup)
    db.commit()
    refreshed = _get_slot_with_signups(db, slot_id)
    assert refreshed is not None
    return refreshed


def list_volunteer_signups_for_member(
    db: Session,
    member_id: int,
) -> list[MemberVolunteerSignupResponse]:
    rows = db.execute(
        select(VolunteerSignup, VolunteerSlot, Event)
        .join(VolunteerSlot, VolunteerSignup.slot_id == VolunteerSlot.id)
        .join(Event, VolunteerSlot.event_id == Event.id)
        .where(VolunteerSignup.member_id == member_id)
        .order_by(Event.starts_at.desc()),
    ).all()

    now = datetime.now(UTC)
    return [
        MemberVolunteerSignupResponse(
            id=signup.id,
            slot_id=signup.slot_id,
            task_name=slot.title,
            event_id=event.id,
            event_name=event.title,
            event_starts_at=event.starts_at,
            signed_up_at=signup.created_at,
            is_done=_event_has_passed(event.starts_at, now),
        )
        for signup, slot, event in rows
    ]


def _event_has_passed(starts_at: datetime, now: datetime) -> bool:
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)
    else:
        starts_at = starts_at.astimezone(UTC)
    return starts_at < now
