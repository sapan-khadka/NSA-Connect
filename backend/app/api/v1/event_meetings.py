from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_board, require_meeting_manager
from app.core.safe_messages import GENERIC_AI_UNAVAILABLE
from app.lib.event_timezone import resolve_event_timezone
from app.models.event import Event
from app.models.member import Member
from app.models.organization import Organization
from app.schemas.meeting import (
    MeetingActionItemResponse,
    MeetingAttendanceUpdateRequest,
    MeetingDetailResponse,
    MeetingDraftUpdateRequest,
    MeetingListResponse,
    MeetingMinutesResponse,
    MeetingNotesUpdateRequest,
    MeetingPublishRequest,
    MeetingSummarizeRequest,
)
from app.services.ai_minutes_service import (
    AIDisabledError,
    AIMinutesSummaryError,
    summarize_meeting_minutes,
)
from app.services.event_service import EventNotFoundError
from app.services.meeting_service import (
    MEETING_DRAFT_CONFLICT_DETAIL,
    MEETING_PUBLISH_OVERVIEW_DETAIL,
    MEETING_PUBLISH_REQUIRED_DETAIL,
    MEETING_REGENERATE_DETAIL,
    InvalidMeetingAttendeeError,
    MeetingDraftConflictError,
    MeetingDraftRequiredError,
    MeetingOverviewRequiredError,
    MeetingRegenerateConfirmationError,
    NotMeetingEventError,
    assert_minutes_can_regenerate,
    get_meeting_detail,
    list_meetings,
    publish_meeting_minutes,
    save_generated_minutes_draft,
    save_minutes_draft,
    update_meeting_attendance,
    update_meeting_notes,
)

router = APIRouter()


@router.get("/meetings", response_model=MeetingListResponse)
def list_meetings_endpoint(
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    return list_meetings(db, current_member)


@router.get("/{event_id}/meeting", response_model=MeetingDetailResponse)
def get_meeting_detail_endpoint(
    event_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return get_meeting_detail(db, event_id, viewer=current_member)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotMeetingEventError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting records are only available for meeting events",
        ) from None


@router.put("/{event_id}/meeting/notes", response_model=MeetingMinutesResponse)
def update_meeting_notes_endpoint(
    event_id: int,
    data: MeetingNotesUpdateRequest,
    current_member: Member = Depends(require_meeting_manager),
    db: Session = Depends(get_db),
):
    try:
        return update_meeting_notes(
            db,
            event_id,
            raw_notes=data.raw_notes,
            updated_by=current_member,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotMeetingEventError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting records are only available for meeting events",
        ) from None


@router.post("/{event_id}/meeting/summarize", response_model=MeetingMinutesResponse)
def summarize_meeting_for_event_endpoint(
    event_id: int,
    data: MeetingSummarizeRequest,
    current_member: Member = Depends(require_meeting_manager),
    db: Session = Depends(get_db),
):
    if not data.raw_notes.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting notes are required",
        )

    try:
        event_detail = get_meeting_detail(db, event_id, viewer=current_member)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotMeetingEventError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting records are only available for meeting events",
        ) from None

    try:
        assert_minutes_can_regenerate(
            db,
            event_id,
            viewer=current_member,
            confirm_regenerate=data.confirm_regenerate,
            base_draft_version=data.base_draft_version,
        )
    except MeetingDraftConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=MEETING_DRAFT_CONFLICT_DETAIL,
        ) from None
    except MeetingRegenerateConfirmationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=MEETING_REGENERATE_DETAIL,
        ) from None

    event = db.get(Event, event_id)
    organization = db.get(Organization, event.organization_id) if event is not None else None
    try:
        summary = summarize_meeting_minutes(
            notes=data.raw_notes,
            meeting_title=event_detail.event_name,
            starts_at=event_detail.starts_at,
            timezone=resolve_event_timezone(organization),
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIMinutesSummaryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_AI_UNAVAILABLE,
        ) from None

    try:
        return save_generated_minutes_draft(
            db,
            event_id,
            raw_notes=data.raw_notes,
            summary=summary,
            updated_by=current_member,
            confirm_regenerate=data.confirm_regenerate,
            base_draft_version=data.base_draft_version,
        )
    except MeetingDraftConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=MEETING_DRAFT_CONFLICT_DETAIL,
        ) from None
    except MeetingRegenerateConfirmationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=MEETING_REGENERATE_DETAIL,
        ) from None


@router.put("/{event_id}/meeting/draft", response_model=MeetingMinutesResponse)
def save_meeting_draft_endpoint(
    event_id: int,
    data: MeetingDraftUpdateRequest,
    current_member: Member = Depends(require_meeting_manager),
    db: Session = Depends(get_db),
):
    try:
        return save_minutes_draft(
            db,
            event_id,
            summary=data.summary,
            key_decisions=data.key_decisions,
            action_items=[
                MeetingActionItemResponse.model_validate(item.model_dump())
                for item in data.action_items
            ],
            base_draft_version=data.base_draft_version,
            updated_by=current_member,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotMeetingEventError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting records are only available for meeting events",
        ) from None
    except MeetingDraftConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=MEETING_DRAFT_CONFLICT_DETAIL,
        ) from None


@router.post("/{event_id}/meeting/publish", response_model=MeetingMinutesResponse)
def publish_meeting_minutes_endpoint(
    event_id: int,
    data: MeetingPublishRequest,
    current_member: Member = Depends(require_meeting_manager),
    db: Session = Depends(get_db),
):
    try:
        return publish_meeting_minutes(
            db,
            event_id,
            base_draft_version=data.base_draft_version,
            updated_by=current_member,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotMeetingEventError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting records are only available for meeting events",
        ) from None
    except MeetingDraftConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=MEETING_DRAFT_CONFLICT_DETAIL,
        ) from None
    except MeetingDraftRequiredError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=MEETING_PUBLISH_REQUIRED_DETAIL,
        ) from None
    except MeetingOverviewRequiredError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=MEETING_PUBLISH_OVERVIEW_DETAIL,
        ) from None


@router.put("/{event_id}/meeting/attendance", response_model=MeetingDetailResponse)
def update_meeting_attendance_endpoint(
    event_id: int,
    data: MeetingAttendanceUpdateRequest,
    current_member: Member = Depends(require_meeting_manager),
    db: Session = Depends(get_db),
):
    try:
        return update_meeting_attendance(
            db,
            event_id,
            entries=data.entries,
            updated_by=current_member,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except NotMeetingEventError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting records are only available for meeting events",
        ) from None
    except InvalidMeetingAttendeeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Attendance can only be recorded for approved board members",
        ) from None
