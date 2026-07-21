"""Event reminder status + manual send for Manage Communications."""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.lib.event_visibility import event_visible_to_member
from app.models.event import Event
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import MemberStatus
from app.models.notification_sent_log import NotificationSentLog, NotificationType
from app.services.event_service import EventNotFoundError
from app.services.notification_email_service import (
    deliver_notification_email,
    send_event_reminder_email,
)
from app.services.notification_sent_store import (
    record_notification_send,
    scheduled_notification_already_sent,
)


class EventReminderNotNeededError(Exception):
    pass


def get_event_notification_status(db: Session, event_id: int) -> dict:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    now = datetime.now(UTC)
    starts_at = event.starts_at
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)
    else:
        starts_at = starts_at.astimezone(UTC)

    hours_until = (starts_at - now).total_seconds() / 3600

    reminder_sent = (
        db.scalar(
            select(func.count())
            .select_from(NotificationSentLog)
            .where(
                NotificationSentLog.event_id == event_id,
                NotificationSentLog.notification_type
                == NotificationType.EVENT_REMINDER,
                NotificationSentLog.success.is_(True),
            ),
        )
        or 0
    )
    nudge_sent = (
        db.scalar(
            select(func.count())
            .select_from(NotificationSentLog)
            .where(
                NotificationSentLog.event_id == event_id,
                NotificationSentLog.notification_type == NotificationType.RSVP_NUDGE,
                NotificationSentLog.success.is_(True),
            ),
        )
        or 0
    )

    last_reminder = db.scalar(
        select(NotificationSentLog.sent_at)
        .where(
            NotificationSentLog.event_id == event_id,
            NotificationSentLog.notification_type == NotificationType.EVENT_REMINDER,
            NotificationSentLog.success.is_(True),
        )
        .order_by(NotificationSentLog.sent_at.desc())
        .limit(1),
    )

    if event.is_upcoming is False:
        reminder_state = "past"
    elif reminder_sent > 0:
        reminder_state = "sent"
    elif 0 < hours_until <= 25:
        reminder_state = "due_soon"
    elif hours_until > 25:
        reminder_state = "scheduled"
    else:
        reminder_state = "none"

    if event.is_upcoming is False:
        nudge_state = "past"
    elif nudge_sent > 0:
        nudge_state = "sent"
    elif 0 < hours_until <= 49:
        nudge_state = "due_soon"
    elif hours_until > 49:
        nudge_state = "scheduled"
    else:
        nudge_state = "none"

    return {
        "event_id": event_id,
        "reminder_state": reminder_state,
        "reminder_sent_count": int(reminder_sent),
        "last_reminder_sent_at": last_reminder,
        "nudge_state": nudge_state,
        "nudge_sent_count": int(nudge_sent),
        "hours_until_start": round(hours_until, 1) if event.is_upcoming else None,
    }


def send_event_reminders_now(db: Session, event_id: int) -> dict[str, int]:
    event = db.scalar(
        select(Event)
        .where(Event.id == event_id)
        .options(selectinload(Event.rsvps).selectinload(EventRsvp.member)),
    )
    if event is None:
        raise EventNotFoundError
    if not event.is_upcoming:
        raise EventReminderNotNeededError

    stats = {"candidates": 0, "sent": 0, "skipped": 0}
    for rsvp in event.rsvps:
        if rsvp.status not in (RsvpStatus.GOING, RsvpStatus.MAYBE):
            continue
        member = rsvp.member
        if member is None or member.status != MemberStatus.APPROVED:
            continue
        if not event_visible_to_member(event, member):
            continue

        stats["candidates"] += 1
        if not member.notify_event_reminders:
            stats["skipped"] += 1
            continue
        if scheduled_notification_already_sent(
            db,
            member_id=member.id,
            notification_type=NotificationType.EVENT_REMINDER,
            event_id=event.id,
        ):
            stats["skipped"] += 1
            continue

        def _send(member=member, event=event, rsvp=rsvp) -> None:
            send_event_reminder_email(
                to_email=member.email,
                full_name=member.full_name,
                event_title=event.title,
                event_starts_at=event.starts_at,
                rsvp_status=rsvp.status,
                event_id=event.id,
            )

        success, error_message = deliver_notification_email(send_callable=_send)
        record_notification_send(
            db,
            member=member,
            notification_type=NotificationType.EVENT_REMINDER,
            success=success,
            event_id=event.id,
            error_message=error_message,
        )
        if success:
            stats["sent"] += 1
        else:
            stats["skipped"] += 1

    return stats
