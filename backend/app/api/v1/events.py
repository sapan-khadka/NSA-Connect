from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.event_checkin import router as event_checkin_router
from app.api.v1.event_meetings import router as event_meetings_router
from app.api.v1.event_photos import router as event_photos_router
from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.event import EventType
from app.models.member import Member, MemberRole
from app.schemas.event import (
    EventAttendeesResponse,
    EventCreateRequest,
    EventDetailResponse,
    EventDuplicateRequest,
    EventListResponse,
    EventPatchRequest,
    EventResponse,
    EventRsvpAttendeeResponse,
    EventRsvpStatusResponse,
    EventRsvpUpdateRequest,
)
from app.schemas.event_feedback import (
    EventFeedbackCreateRequest,
    EventFeedbackListResponse,
    EventFeedbackResponse,
)
from app.models.event_volunteer_signup import EventVolunteerSignupStatus
from app.schemas.event_volunteer_signup import (
    EventVolunteerSignupCreateRequest,
    EventVolunteerSignupListResponse,
    EventVolunteerSignupMemberResponse,
    EventVolunteerSignupResponse,
    EventVolunteerSignupReviewRequest,
)
from app.schemas.member import (
    EventParticipantInvitationCreateRequest,
    EventParticipantInvitationListResponse,
    EventParticipantInvitationResponse,
)
from app.schemas.preptask import PrepTaskCreateRequest, PrepTaskResponse
from app.schemas.event_activity import (
    EventActivityItemResponse,
    EventActivityListResponse,
)
from app.schemas.event_notification import (
    EventNotificationStatusResponse,
    EventReminderSendResponse,
)
from app.schemas.volunteer import (
    VolunteerSlotCreateRequest,
    VolunteerSlotListResponse,
    VolunteerSlotResponse,
)
from app.services.event_feedback_service import (
    EventNotPastError,
    get_member_event_feedback,
    list_event_feedback,
    submit_event_feedback,
)
from app.services.event_feedback_service import (
    to_member_response as to_feedback_response,
)
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
    duplicate_event,
    get_event_with_prep_tasks_for_member,
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
from app.services.event_volunteer_signup_service import (
    NotVolunteeredError,
    VolunteerSignupNotFoundError,
    VolunteerSignupNotPendingError,
    get_member_volunteer_signup,
    list_event_volunteer_signups,
    review_volunteer_signup,
    to_member_response,
    volunteer_for_event,
    withdraw_volunteer_signup,
)
from app.services.member_service import MemberNotFoundError
from app.services.rsvp_service import (
    AlreadyRsvpedError,
    EventAtCapacityError,
    EventNotUpcomingError,
    NotRsvpedError,
    cancel_event_rsvp,
    get_member_rsvp_status,
    list_event_attendees,
    rsvp_to_event,
    set_event_rsvp_status,
)
from app.services.event_activity_service import list_event_activity
from app.services.event_notification_service import (
    EventReminderNotNeededError,
    get_event_notification_status,
    send_event_reminders_now,
)
from app.services.volunteer_service import (
    create_volunteer_slot_for_event,
    list_volunteer_slots_for_event,
)

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
    volunteer_signup = get_member_volunteer_signup(
        db,
        event_id=event.id,
        member_id=member_id,
    )
    member_feedback = get_member_event_feedback(
        db,
        event_id=event.id,
        member_id=member_id,
    )
    return EventDetailResponse.from_event(
        event,
        current_member_rsvp_status=current_status,
        current_member_is_invited_participant=is_invited,
        current_member_volunteer_signup=(
            to_member_response(volunteer_signup)
            if volunteer_signup is not None
            else None
        ),
        current_member_feedback=(
            to_feedback_response(member_feedback)
            if member_feedback is not None
            else None
        ),
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
    events, total = list_events(
        db,
        month=month,
        event_type=event_type,
        viewer=current_member,
    )
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
    events, total = list_upcoming_events(db, limit=limit, viewer=current_member)
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
    events, total = list_past_events(
        db,
        limit=limit,
        offset=offset,
        viewer=current_member,
    )
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
        event = get_event_with_prep_tasks_for_member(
            db,
            event_id,
            viewer=current_member,
        )
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
    except EventAtCapacityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "event_at_capacity",
                "message": "Event is at capacity. You can join the waitlist.",
                "capacity": exc.capacity,
                "going_count": exc.going_count,
            },
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
    except EventAtCapacityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "event_at_capacity",
                "message": "Event is at capacity. You can join the waitlist.",
                "capacity": exc.capacity,
                "going_count": exc.going_count,
            },
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


@router.post(
    "/{event_id}/volunteer-signup",
    response_model=EventVolunteerSignupResponse,
    status_code=status.HTTP_201_CREATED,
)
def volunteer_for_event_endpoint(
    event_id: int,
    data: EventVolunteerSignupCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        signup = volunteer_for_event(
            db,
            event_id=event_id,
            member_id=current_member.id,
            data=data,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventNotUpcomingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Volunteer signups are closed for past events",
        ) from None

    return to_member_response(signup)


@router.delete("/{event_id}/volunteer-signup", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_volunteer_signup_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        withdraw_volunteer_signup(
            db,
            event_id=event_id,
            member_id=current_member.id,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventNotUpcomingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Volunteer signups are closed for past events",
        ) from None
    except NotVolunteeredError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer signup not found",
        ) from None

    return None


@router.get(
    "/{event_id}/volunteer-signups",
    response_model=EventVolunteerSignupListResponse,
)
def list_event_volunteer_signups_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        signups = list_event_volunteer_signups(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventVolunteerSignupListResponse(signups=signups, total=len(signups))


@router.patch(
    "/{event_id}/volunteer-signups/{signup_id}",
    response_model=EventVolunteerSignupMemberResponse,
)
def review_volunteer_signup_endpoint(
    event_id: int,
    signup_id: int,
    data: EventVolunteerSignupReviewRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        signup = review_volunteer_signup(
            db,
            event_id=event_id,
            signup_id=signup_id,
            status=EventVolunteerSignupStatus(data.status),
            reviewer=current_member,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except VolunteerSignupNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer signup not found",
        ) from None
    except VolunteerSignupNotPendingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending volunteer requests can be reviewed",
        ) from None

    return EventVolunteerSignupMemberResponse(
        id=signup.id,
        member_id=signup.member_id,
        full_name=signup.member.full_name,
        note=signup.note,
        status=signup.status,
        created_at=signup.created_at,
        reviewed_at=signup.reviewed_at,
    )


@router.post(
    "/{event_id}/feedback",
    response_model=EventFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_event_feedback_endpoint(
    event_id: int,
    data: EventFeedbackCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        feedback = submit_event_feedback(
            db,
            event_id=event_id,
            member_id=current_member.id,
            data=data,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventNotPastError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Feedback is only available after an event has taken place",
        ) from None

    return to_feedback_response(feedback)


@router.get(
    "/{event_id}/feedback",
    response_model=EventFeedbackListResponse,
)
def list_event_feedback_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return list_event_feedback(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None


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
            purpose=data.purpose,
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
        waitlisted_count=counts.waitlisted_count,
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


@router.get(
    "/{event_id}/slots",
    response_model=VolunteerSlotListResponse,
)
def list_volunteer_slots_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        slots = list_volunteer_slots_for_event(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    include_roster = current_member.role.is_at_least(MemberRole.BOARD)
    return VolunteerSlotListResponse(
        slots=[
            VolunteerSlotResponse.from_slot(
                slot,
                member_id=current_member.id,
                include_roster=include_roster,
            )
            for slot in slots
        ],
        total=len(slots),
    )


@router.post(
    "/{event_id}/slots",
    response_model=VolunteerSlotResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_volunteer_slot_endpoint(
    event_id: int,
    data: VolunteerSlotCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        slot = create_volunteer_slot_for_event(db, event_id, data)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return VolunteerSlotResponse.from_slot(
        slot,
        member_id=current_member.id,
        include_roster=True,
    )


@router.get(
    "/{event_id}/activity",
    response_model=EventActivityListResponse,
)
def event_activity_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        rows = list_event_activity(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    items = [
        EventActivityItemResponse(
            id=row["id"],
            kind=row["kind"],
            title=row["title"],
            detail=row.get("detail"),
            occurred_at=row["occurred_at"],
        )
        for row in rows
    ]
    return EventActivityListResponse(items=items, total=len(items))


@router.get(
    "/{event_id}/notification-status",
    response_model=EventNotificationStatusResponse,
)
def event_notification_status_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return EventNotificationStatusResponse(**get_event_notification_status(db, event_id))
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None


@router.post(
    "/{event_id}/reminders/send",
    response_model=EventReminderSendResponse,
)
def send_event_reminders_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        stats = send_event_reminders_now(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventReminderNotNeededError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reminders can only be sent for upcoming events",
        ) from None
    return EventReminderSendResponse(**stats)


@router.post(
    "/{event_id}/duplicate",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_event_endpoint(
    event_id: int,
    data: EventDuplicateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        event = duplicate_event(
            db,
            event_id,
            data,
            created_by_id=current_member.id,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return _build_event_response(db, event, member_id=current_member.id)


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
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
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
