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
from app.schemas.preptask import PrepTaskCreateRequest, PrepTaskResponse
from app.services.event_service import (
    EventNotFoundError,
    create_event,
    get_event_with_prep_tasks,
    list_events,
)
from app.services.prep_task_service import (
    InvalidAssigneeError,
    InvalidPrepTaskDueDateError,
    PrepTaskGroupNotFoundError,
    create_prep_task_for_event,
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
            detail="Assignee must be an approved member",
        ) from None
    except InvalidPrepTaskDueDateError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None

    return PrepTaskResponse.from_prep_task(prep_task)


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
