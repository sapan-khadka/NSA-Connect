from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.volunteer import VolunteerSignup, VolunteerSlot
from app.schemas.volunteer import VolunteerSlotCreateRequest
from app.services.event_service import EventNotFoundError


class VolunteerSlotNotFoundError(Exception):
    pass


class VolunteerSlotFullError(Exception):
    pass


class AlreadySignedUpError(Exception):
    pass


def _get_slot_with_signups(db: Session, slot_id: int) -> VolunteerSlot | None:
    return db.scalar(
        select(VolunteerSlot)
        .where(VolunteerSlot.id == slot_id)
        .options(
            selectinload(VolunteerSlot.signups),
            selectinload(VolunteerSlot.event),
        ),
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
        description="",
        capacity=data.max_signup_count,
        created_at=datetime.now(UTC),
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def signup_for_volunteer_slot(
    db: Session,
    slot_id: int,
    member_id: int,
) -> tuple[VolunteerSignup, VolunteerSlot]:
    slot = _get_slot_with_signups(db, slot_id)
    if slot is None:
        raise VolunteerSlotNotFoundError

    existing = db.scalar(
        select(VolunteerSignup.id).where(
            VolunteerSignup.slot_id == slot_id,
            VolunteerSignup.member_id == member_id,
        ),
    )
    if existing is not None:
        raise AlreadySignedUpError

    signup_count = db.scalar(
        select(func.count())
        .select_from(VolunteerSignup)
        .where(VolunteerSignup.slot_id == slot_id),
    ) or 0
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
