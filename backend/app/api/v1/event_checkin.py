from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.core.rate_limit import (
    guest_checkin_event_key,
    guest_checkin_global_key,
    limit,
)
from app.models.event import Event
from app.models.event_guest_checkin import GuestAffiliationType
from app.models.member import Member
from app.schemas.event_checkin import (
    EventAttendanceSummaryResponse,
    EventCheckInListResponse,
    EventCheckInQrResponse,
    EventCheckInRecordResponse,
    EventCheckInRequest,
    EventCheckInResultResponse,
    EventGuestCheckInRequest,
    EventGuestCheckInResultResponse,
)
from app.services.event_checkin_service import (
    CheckInResultStatus,
    CheckInWindowClosedError,
    InvalidCheckInTokenError,
    get_attendance_summary,
    get_checkin_qr_info,
    list_event_checkins,
    perform_checkin,
    perform_guest_checkin,
    regenerate_checkin_token,
)
from app.services.event_service import EventNotFoundError

router = APIRouter(tags=["event-checkin"])


@router.get("/{event_id}/checkin/qr", response_model=EventCheckInQrResponse)
def get_event_checkin_qr_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        event, token, checkin_url = get_checkin_qr_info(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventCheckInQrResponse(
        event_id=event.id,
        event_name=event.title,
        checkin_url=checkin_url,
        token=token,
    )


@router.post("/{event_id}/checkin/regenerate", response_model=EventCheckInQrResponse)
def regenerate_event_checkin_qr_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    from app.services.event_checkin_service import build_checkin_url

    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    token = regenerate_checkin_token(db, event)
    return EventCheckInQrResponse(
        event_id=event.id,
        event_name=event.title,
        checkin_url=build_checkin_url(event.id, token),
        token=token,
    )


@router.get("/{event_id}/checkins", response_model=EventCheckInListResponse)
def list_event_checkins_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        rows = list_event_checkins(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    checkins = [
        EventCheckInRecordResponse(
            kind=row.kind,
            member_id=row.member_id,
            guest_id=row.guest_id,
            full_name=row.full_name,
            email=row.email,
            affiliation_type=row.affiliation_type,
            related_member_name=row.related_member_name,
            checked_in_at=row.checked_in_at,
        )
        for row in rows
    ]
    return EventCheckInListResponse(checkins=checkins, total=len(checkins))


@router.post("/{event_id}/checkin", response_model=EventCheckInResultResponse)
def check_in_to_event_endpoint(
    event_id: int,
    data: EventCheckInRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        result = perform_checkin(
            db,
            event_id=event_id,
            member_id=current_member.id,
            token=data.token,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except InvalidCheckInTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This check-in link is no longer valid.",
        ) from None
    except CheckInWindowClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in is not open for this event right now.",
        ) from None

    if result.status == CheckInResultStatus.ALREADY_CHECKED_IN:
        return EventCheckInResultResponse(
            status="already_checked_in",
            event_id=result.event.id,
            event_name=result.event.title,
            checked_in_at=result.checked_in_at,
            message=f"You're already checked in for {result.event.title}.",
        )

    return EventCheckInResultResponse(
        status="checked_in",
        event_id=result.event.id,
        event_name=result.event.title,
        checked_in_at=result.checked_in_at,
        message=f"You're checked in! {result.event.title}",
    )


@router.post("/{event_id}/checkin/guest", response_model=EventGuestCheckInResultResponse)
@limit(
    f"{settings.RATE_LIMIT_GUEST_CHECKIN_GLOBAL_IP_MAX}/{settings.RATE_LIMIT_GUEST_CHECKIN_GLOBAL_IP_WINDOW_SECONDS}second",
    key_func=guest_checkin_global_key,
)
@limit(
    f"{settings.RATE_LIMIT_GUEST_CHECKIN_EVENT_IP_MAX}/{settings.RATE_LIMIT_GUEST_CHECKIN_EVENT_IP_WINDOW_SECONDS}second",
    key_func=guest_checkin_event_key,
)
def check_in_guest_to_event_endpoint(
    request: Request,
    event_id: int,
    data: EventGuestCheckInRequest,
    db: Session = Depends(get_db),
):
    affiliation_type = (
        GuestAffiliationType(data.affiliation_type) if data.affiliation_type else None
    )

    try:
        result = perform_guest_checkin(
            db,
            event_id=event_id,
            token=data.token,
            guest_name=data.guest_name,
            affiliation_type=affiliation_type,
            related_member_name=data.related_member_name,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except InvalidCheckInTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This check-in link is no longer valid.",
        ) from None
    except CheckInWindowClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in is not open for this event right now.",
        ) from None

    return EventGuestCheckInResultResponse(
        status="checked_in",
        event_id=result.event.id,
        event_name=result.event.title,
        guest_name=result.guest_name,
        checked_in_at=result.checked_in_at,
        message=f"You're checked in! {result.event.title}",
    )


@router.get("/{event_id}/attendance-summary", response_model=EventAttendanceSummaryResponse)
def get_event_attendance_summary_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        summary = get_attendance_summary(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventAttendanceSummaryResponse.model_validate(summary)
