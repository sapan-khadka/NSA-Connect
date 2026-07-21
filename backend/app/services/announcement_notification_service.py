import logging

from sqlalchemy.orm import Session

from app.models.announcement import Announcement
from app.models.notification_sent_log import NotificationType
from app.services.announcement_recipients import list_announcement_recipients
from app.services.notification_email_service import (
    deliver_notification_email,
    send_announcement_email,
)
from app.services.notification_sent_store import record_notification_send

logger = logging.getLogger(__name__)


def notify_announcement_broadcast(
    db: Session, announcement: Announcement
) -> dict[str, int]:
    members = list_announcement_recipients(db, announcement)

    stats = {"candidates": len(members), "sent": 0, "skipped": 0}
    author_name = announcement.author.full_name

    for member in members:
        if not member.notify_announcements:
            stats["skipped"] += 1
            continue

        def _send() -> None:
            send_announcement_email(
                to_email=member.email,
                full_name=member.full_name,
                announcement_title=announcement.title,
                announcement_body=announcement.body,
                author_name=author_name,
            )

        try:
            success, error_message = deliver_notification_email(send_callable=_send)
            record_notification_send(
                db,
                member=member,
                notification_type=NotificationType.ANNOUNCEMENT,
                success=success,
                announcement_id=announcement.id,
                error_message=error_message,
            )
            if success:
                stats["sent"] += 1
        except Exception:
            logger.exception(
                "Failed announcement email member_id=%s announcement_id=%s",
                member.id,
                announcement.id,
            )

    logger.info(
        "Announcement broadcast complete announcement_id=%s sent=%s skipped=%s",
        announcement.id,
        stats["sent"],
        stats["skipped"],
    )
    return stats
