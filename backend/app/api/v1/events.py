from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.event import EventType
from app.models.member import Member
from app.schemas.event import (
    EventCreateRequest,
    EventDetailResponse,
    EventListResponse,
    EventResponse,
)
from app.services.event_service import (
    EventNotFoundError,
    create_event,
    get_event_with_prep_tasks,
    list_events,
)

router = APIRouter(prefix="/events", tags=["events"])

MONTH_QUERY_PATTERN = r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"


@router.get("", response_model=EventListResponse)
def list_events_endpoint(
    month: str | None = Query(
        default=None,
        pattern=MONTH_QUERY_PATTERN,
        description="Filter by calendar month in YYYY-MM format",
    ),
    event_type: EventType | None = Query(
        default=None,
        description="Filter by event type",
    ),
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    events, total = list_events(db, month=month, event_type=event_type)
    return EventListResponse(
        events=[EventResponse.from_event(event) for event in events],
        total=total,
    )


@router.get("/{event_id}", response_model=EventDetailResponse)
def get_event_endpoint(
    event_id: int,
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        event = get_event_with_prep_tasks(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventDetailResponse.from_event(event)


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_endpoint(
    data: EventCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    event = create_event(
        db,
        data,
        created_by_id=current_member.id,
    )
    return EventResponse.from_event(event)
