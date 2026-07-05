from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.event import EventType
from app.models.member import Member
from app.schemas.member import (
    EventParticipantInvitationCreateRequest,
    EventParticipantInvitationListResponse,
    EventParticipantInvitationResponse,
)
from app.schemas.event import (
    EventAttendeesResponse,
    EventCreateRequest,
    EventDetailResponse,
    EventListResponse,
    EventPatchRequest,
    EventResponse,
    EventRsvpAttendeeResponse,
    EventRsvpStatusResponse,
    EventRsvpUpdateRequest,
)
from app.schemas.preptask import PrepTaskCreateRequest, PrepTaskResponse
from app.schemas.volunteer import VolunteerSlotCreateRequest, VolunteerSlotResponse
from app.services.event_invitation_service import (
    invite_members_to_event,
    is_member_invited_to_event,
    list_event_participant_invitations,
    remove_event_participant_invitation,
)
from app.services.event_service import (
    EventNotFoundError,
    create_event,
    delete_event,
    get_event_with_prep_tasks,
    list_events,
    list_past_events,
    list_upcoming_events,
    update_event,
)
from app.services.event_task_service import (
    InvalidEventTaskAssigneeError,
    InvalidPrepTaskDueDateError,
    PrepTaskGroupNotFoundError,
    create_checklist_event_task,
)
from app.services.rsvp_service import (
    AlreadyRsvpedError,
    EventNotUpcomingError,
    NotRsvpedError,
    cancel_event_rsvp,
    get_member_rsvp_status,
    list_event_attendees,
    rsvp_to_event,
    set_event_rsvp_status,
)
from app.services.member_service import MemberNotFoundError
from app.services.volunteer_service import create_volunteer_slot_for_event
from app.api.v1.event_meetings import router as event_meetings_router
from app.api.v1.event_photos import router as event_photos_router
from app.api.v1.event_checkin import router as event_checkin_router

router = APIRouter(prefix="/events", tags=["events"])
router.include_router(event_photos_router)
router.include_router(event_meetings_router)
router.include_router(event_checkin_router)

MONTH_QUERY_PATTERN = r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"


def _build_event_response(
    db: Session,
    event,
    *,
    member_id: int,
) -> EventResponse:
    current_status = get_member_rsvp_status(db, event.id, member_id)
    is_invited = is_member_invited_to_event(db, event.id, member_id)
    return EventResponse.from_event(
        event,
        current_member_rsvp_status=current_status,
        current_member_is_invited_participant=is_invited,
    )


def _build_event_detail_response(
    db: Session,
    event,
    *,
    member_id: int,
) -> EventDetailResponse:
    current_status = get_member_rsvp_status(db, event.id, member_id)
    is_invited = is_member_invited_to_event(db, event.id, member_id)
    return EventDetailResponse.from_event(
        event,
        current_member_rsvp_status=current_status,
        current_member_is_invited_participant=is_invited,
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


@router.get("/upcoming", response_model=EventListResponse)
def list_upcoming_events_endpoint(
    limit: int = Query(default=50, ge=1, le=100),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    events, total = list_upcoming_events(db, limit=limit)
    return EventListResponse(
        events=[
            _build_event_response(db, event, member_id=current_member.id)
            for event in events
        ],
        total=total,
    )


@router.get("/past", response_model=EventListResponse)
def list_past_events_endpoint(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    events, total = list_past_events(db, limit=limit, offset=offset)
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


@router.put("/{event_id}/rsvp", response_model=EventRsvpStatusResponse)
def update_event_rsvp_endpoint(
    event_id: int,
    data: EventRsvpUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        rsvp_status = set_event_rsvp_status(
            db,
            event_id,
            current_member.id,
            data.status,
        )
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

    return EventRsvpStatusResponse(
        event_id=event_id,
        current_member_rsvp_status=rsvp_status,
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
        rsvp_status = rsvp_to_event(db, event_id, current_member.id)
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
        current_member_rsvp_status=rsvp_status,
    )


@router.delete("/{event_id}/rsvp", response_model=EventRsvpStatusResponse)
def cancel_event_rsvp_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        cancel_event_rsvp(db, event_id, current_member.id)
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
        current_member_rsvp_status=None,
    )


@router.get(
    "/{event_id}/invited-participants",
    response_model=EventParticipantInvitationListResponse,
)
def list_event_invited_participants_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        invitations = list_event_participant_invitations(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventParticipantInvitationListResponse(
        invitations=[
            EventParticipantInvitationResponse.from_invitation(invitation)
            for invitation in invitations
        ],
        total=len(invitations),
    )


@router.post(
    "/{event_id}/invited-participants",
    response_model=EventParticipantInvitationListResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_event_participants_endpoint(
    event_id: int,
    data: EventParticipantInvitationCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        invitations = invite_members_to_event(
            db,
            event_id=event_id,
            member_ids=data.member_ids,
            invited_by_id=current_member.id,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more members were not found",
        ) from None

    return EventParticipantInvitationListResponse(
        invitations=[
            EventParticipantInvitationResponse.from_invitation(invitation)
            for invitation in invitations
        ],
        total=len(invitations),
    )


@router.delete(
    "/{event_id}/invited-participants/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_event_invited_participant_endpoint(
    event_id: int,
    member_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        remove_event_participant_invitation(
            db,
            event_id=event_id,
            member_id=member_id,
        )
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        ) from None

    return None


@router.get("/{event_id}/rsvps", response_model=EventAttendeesResponse)
def list_event_attendees_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        counts, attendees = list_event_attendees(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventAttendeesResponse(
        going_count=counts.going_count,
        maybe_count=counts.maybe_count,
        not_going_count=counts.not_going_count,
        no_response_count=counts.no_response_count,
        attendees=[
            EventRsvpAttendeeResponse(
                member_id=attendee.member_id,
                full_name=attendee.full_name,
                member_type=attendee.member_type,
                rsvp_status=attendee.rsvp_status,
            )
            for attendee in attendees
        ],
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
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        task = create_checklist_event_task(
            db,
            event_id,
            data,
            created_by=current_member,
        )
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
    except InvalidEventTaskAssigneeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must be an approved board member",
        ) from None
    except InvalidPrepTaskDueDateError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None

    return PrepTaskResponse.from_event_task(task)


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


@router.patch("/{event_id}", response_model=EventResponse)
def patch_event_endpoint(
    event_id: int,
    data: EventPatchRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        event = update_event(db, event_id, data)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

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
