from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.ai import SummarizeMinutesResponse
from app.schemas.meeting import (
    MeetingAttendanceUpdateRequest,
    MeetingDetailResponse,
    MeetingListResponse,
    MeetingMinutesResponse,
    MeetingNotesUpdateRequest,
)
from app.services.ai_minutes_service import (
    AIDisabledError,
    AIMinutesSummaryError,
    summarize_meeting_minutes,
)
from app.services.event_service import EventNotFoundError
from app.services.meeting_service import (
    InvalidMeetingAttendeeError,
    NotMeetingEventError,
    can_manage_meeting_records,
    get_meeting_detail,
    list_meetings,
    save_meeting_summary,
    update_meeting_attendance,
    update_meeting_notes,
)

router = APIRouter()


def _require_meeting_manager(
    current_member: Member = Depends(get_current_member),
) -> Member:
    if not can_manage_meeting_records(current_member):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires secretary, vice president, or president",
        )
    return current_member


@router.get("/meetings", response_model=MeetingListResponse)
def list_meetings_endpoint(
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    return list_meetings(db)


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
    current_member: Member = Depends(_require_meeting_manager),
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
    data: MeetingNotesUpdateRequest,
    current_member: Member = Depends(_require_meeting_manager),
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
        summary = summarize_meeting_minutes(
            notes=data.raw_notes,
            meeting_title=event_detail.event_name,
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIMinutesSummaryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from None

    return save_meeting_summary(
        db,
        event_id,
        raw_notes=data.raw_notes,
        summary=summary,
        updated_by=current_member,
    )


@router.put("/{event_id}/meeting/attendance", response_model=MeetingDetailResponse)
def update_meeting_attendance_endpoint(
    event_id: int,
    data: MeetingAttendanceUpdateRequest,
    current_member: Member = Depends(_require_meeting_manager),
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
