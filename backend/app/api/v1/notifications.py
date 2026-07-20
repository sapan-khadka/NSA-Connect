from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.core.safe_messages import GENERIC_EMAIL_SEND_FAILED
from app.integrations.resend_client import ResendDeliveryError
from app.models.member import Member
from app.schemas.inbox_notification import (
    InboxNotificationListResponse,
    MarkAllInboxReadResponse,
    MarkInboxReadResponse,
)
from app.schemas.notification_check import RunNotificationCheckRequest
from app.schemas.notification_preferences import (
    NotificationPreferencesResponse,
    NotificationPreferencesUpdateRequest,
)
from app.schemas.notification_summary import NotificationSummaryResponse
from app.schemas.test_email import SendTestEmailRequest
from app.services.inbox_notification_service import (
    InboxNotificationNotFoundError,
    list_inbox_notifications,
    mark_all_inbox_notifications_read,
    mark_inbox_notification_read,
)
from app.services.notification_preferences_service import (
    get_notification_preferences,
    update_notification_preferences,
)
from app.services.notification_scan_service import run_scheduled_notification_checks
from app.services.notification_summary_service import get_notification_summary
from app.services.resend_email_service import send_test_email

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/summary", response_model=NotificationSummaryResponse)
def get_my_notification_summary(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return get_notification_summary(db, current_member)


@router.get("", response_model=InboxNotificationListResponse)
def list_my_inbox_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return list_inbox_notifications(db, member_id=current_member.id, limit=limit)


@router.patch("/{notification_id}/read", response_model=MarkInboxReadResponse)
def mark_my_inbox_notification_read(
    notification_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return mark_inbox_notification_read(
            db,
            member_id=current_member.id,
            notification_id=notification_id,
        )
    except InboxNotificationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        ) from exc


@router.post("/read-all", response_model=MarkAllInboxReadResponse)
def mark_all_my_inbox_notifications_read(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return mark_all_inbox_notifications_read(db, member_id=current_member.id)


@router.get("/preferences", response_model=NotificationPreferencesResponse)
def get_my_notification_preferences(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return get_notification_preferences(db, current_member.id)


@router.patch("/preferences", response_model=NotificationPreferencesResponse)
def update_my_notification_preferences(
    data: NotificationPreferencesUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return update_notification_preferences(db, current_member.id, data)


@router.post("/test-email")
def send_test_email_endpoint(
    payload: SendTestEmailRequest,
    current_member: Member = Depends(require_board),
):
    try:
        email_id = send_test_email(to_email=str(payload.to_email))
    except ResendDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_EMAIL_SEND_FAILED,
        ) from None

    return {
        "success": True,
        "message": f"Test email sent to {payload.to_email}.",
        "email_id": email_id,
    }


@router.post("/run-check")
def run_notification_check_endpoint(
    payload: RunNotificationCheckRequest | None = None,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    as_of = payload.as_of if payload else None
    return run_scheduled_notification_checks(db, as_of=as_of)
