from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.schemas.public_event import PublicEventResponse
from app.services.event_service import EventNotFoundError
from app.services.public_event_service import get_public_event

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/events/{event_id}", response_model=PublicEventResponse)
def get_public_event_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
):
    try:
        event = get_public_event(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    going_count = (
        db.scalar(
            select(func.count())
            .select_from(EventRsvp)
            .where(
                EventRsvp.event_id == event_id,
                EventRsvp.status == RsvpStatus.GOING,
            ),
        )
        or 0
    )
    return PublicEventResponse.from_event(event, going_count=int(going_count))
