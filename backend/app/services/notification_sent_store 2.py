import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.member import Member
from app.models.notification_sent_log import (
    SCHEDULED_NOTIFICATION_TYPES,
    NotificationSentLog,
    NotificationType,
)

logger = logging.getLogger(__name__)


def scheduled_notification_already_sent(
    db: Session,
    *,
    member_id: int,
    notification_type: NotificationType,
    event_id: int | None = None,
    event_task_id: int | None = None,
    semester: str | None = None,
) -> bool:
    if notification_type not in SCHEDULED_NOTIFICATION_TYPES:
        return False

    query = select(NotificationSentLog.id).where(
        NotificationSentLog.member_id == member_id,
        NotificationSentLog.notification_type == notification_type,
        NotificationSentLog.success.is_(True),
    )

    if event_id is not None:
        query = query.where(NotificationSentLog.event_id == event_id)
    if event_task_id is not None:
        query = query.where(NotificationSentLog.event_task_id == event_task_id)
    if semester is not None:
        query = query.where(NotificationSentLog.semester == semester)

    return db.scalar(query.limit(1)) is not None


def record_notification_send(
    db: Session,
    *,
    member: Member,
    notification_type: NotificationType,
    success: bool,
    event_id: int | None = None,
    event_task_id: int | None = None,
    announcement_id: int | None = None,
    semester: str | None = None,
    error_message: str | None = None,
) -> NotificationSentLog:
    log_entry = NotificationSentLog(
        member_id=member.id,
        notification_type=notification_type,
        event_id=event_id,
        event_task_id=event_task_id,
        announcement_id=announcement_id,
        semester=semester,
        recipient_email=member.email,
        success=success,
        error_message=error_message,
        sent_at=datetime.now(UTC),
    )
    try:
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
    except Exception:
        db.rollback()
        logger.exception(
            "Failed to persist notification log type=%s member_id=%s email=%s",
            notification_type.value,
            member.id,
            member.email,
        )
        return log_entry

    if success:
        logger.info(
            "Notification sent type=%s member_id=%s email=%s "
            "event_id=%s event_task_id=%s semester=%s",
            notification_type.value,
            member.id,
            member.email,
            event_id,
            event_task_id,
            semester,
        )
    else:
        logger.error(
            "Notification failed type=%s member_id=%s email=%s "
            "event_id=%s event_task_id=%s semester=%s error=%s",
            notification_type.value,
            member.id,
            member.email,
            event_id,
            event_task_id,
            semester,
            error_message,
        )

    return log_entry
