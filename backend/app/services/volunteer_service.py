from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.volunteer import VolunteerSlot
from app.schemas.volunteer import VolunteerSlotCreateRequest
from app.services.event_service import EventNotFoundError


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
