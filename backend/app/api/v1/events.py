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
    EventRsvpStatusResponse,
)
from app.schemas.preptask import PrepTaskCreateRequest, PrepTaskResponse
from app.schemas.volunteer import VolunteerSlotCreateRequest, VolunteerSlotResponse
from app.services.event_service import (
    EventNotFoundError,
    create_event,
    delete_event,
    get_event_with_prep_tasks,
    list_events,
)
from app.services.prep_task_service import (
    InvalidAssigneeError,
    InvalidPrepTaskDueDateError,
    PrepTaskGroupNotFoundError,
    create_prep_task_for_event,
)
from app.services.rsvp_service import (
    AlreadyRsvpedError,
    EventNotUpcomingError,
    NotRsvpedError,
    cancel_event_rsvp,
    get_event_rsvp_status,
    rsvp_to_event,
)
from app.services.volunteer_service import create_volunteer_slot_for_event

router = APIRouter(prefix="/events", tags=["events"])

MONTH_QUERY_PATTERN = r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"


def _build_event_response(
    db: Session,
    event,
    *,
    member_id: int,
) -> EventResponse:
    rsvp_count, has_rsvped = get_event_rsvp_status(db, event.id, member_id)
    return EventResponse.from_event(
        event,
        rsvp_count=rsvp_count,
        current_member_has_rsvped=has_rsvped,
    )


def _build_event_detail_response(
    db: Session,
    event,
    *,
    member_id: int,
) -> EventDetailResponse:
    rsvp_count, has_rsvped = get_event_rsvp_status(db, event.id, member_id)
    return EventDetailResponse.from_event(
        event,
        rsvp_count=rsvp_count,
        current_member_has_rsvped=has_rsvped,
    )


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
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    events, total = list_events(db, month=month, event_type=event_type)
    return EventListResponse(
        events=[
            _build_event_response(db, event, member_id=current_member.id)
            for event in events
        ],
        total=total,
    )


@router.get("/{event_id}", response_model=EventDetailResponse)
def get_event_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        event = get_event_with_prep_tasks(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return _build_event_detail_response(
        db,
        event,
        member_id=current_member.id,
    )


@router.post(
    "/{event_id}/rsvp",
    response_model=EventRsvpStatusResponse,
    status_code=status.HTTP_201_CREATED,
)
def rsvp_to_event_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        rsvp_count, has_rsvped = rsvp_to_event(db, event_id, current_member.id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventNotUpcomingError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot RSVP to a past event",
        ) from None
    except AlreadyRsvpedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already RSVPed to this event",
        ) from None

    return EventRsvpStatusResponse(
        event_id=event_id,
        rsvp_count=rsvp_count,
        current_member_has_rsvped=has_rsvped,
    )


@router.delete("/{event_id}/rsvp", response_model=EventRsvpStatusResponse)
def cancel_event_rsvp_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        rsvp_count, has_rsvped = cancel_event_rsvp(db, event_id, current_member.id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotRsvpedError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RSVP not found",
        ) from None

    return EventRsvpStatusResponse(
        event_id=event_id,
        rsvp_count=rsvp_count,
        current_member_has_rsvped=has_rsvped,
    )


@router.post(
    "/{event_id}/tasks",
    response_model=PrepTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/{event_id}/prep-tasks",
    response_model=PrepTaskResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def add_prep_task_endpoint(
    event_id: int,
    data: PrepTaskCreateRequest,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        prep_task = create_prep_task_for_event(db, event_id, data)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except PrepTaskGroupNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prep task group not found",
        ) from None
    except InvalidAssigneeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must be an approved board member",
        ) from None
    except InvalidPrepTaskDueDateError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None

    return PrepTaskResponse.from_prep_task(prep_task)


@router.post(
    "/{event_id}/slots",
    response_model=VolunteerSlotResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_volunteer_slot_endpoint(
    event_id: int,
    data: VolunteerSlotCreateRequest,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        slot = create_volunteer_slot_for_event(db, event_id, data)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return VolunteerSlotResponse.from_slot(slot)


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
    return _build_event_response(db, event, member_id=current_member.id)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        delete_event(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return None
