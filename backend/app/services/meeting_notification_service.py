from typing import Literal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.event import Event
from app.models.member import Member
from app.services.member_service import list_assignable_board_members

MeetingNotificationKind = Literal["attendance", "notes", "summary"]


def build_meeting_detail_url(event_id: int) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/events/meetings/{event_id}"


def notify_board_of_meeting_update(
    db: Session,
    *,
    event_id: int,
    updated_by: Member,
    notification_kind: MeetingNotificationKind,
) -> int:
    from app.tasks.email_tasks import send_meeting_record_notification_email_task

    event = db.get(Event, event_id)
    if event is None:
        return 0

    meeting_url = build_meeting_detail_url(event_id)
    queued = 0

    for member in list_assignable_board_members(db):
        if member.id == updated_by.id:
            continue

        send_meeting_record_notification_email_task.delay(
            email=member.email,
            full_name=member.full_name,
            meeting_title=event.title,
            notification_kind=notification_kind,
            recorded_by_name=updated_by.full_name,
            meeting_starts_at_iso=event.starts_at.isoformat(),
            meeting_url=meeting_url,
        )
        queued += 1

    return queued
