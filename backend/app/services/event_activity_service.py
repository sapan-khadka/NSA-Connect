"""Aggregate a real activity feed for Event Manage Record tab."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.announcement import Announcement
from app.models.event import Event
from app.models.event_checkin import EventCheckIn
from app.models.event_rsvp import EventRsvp
from app.models.notification_sent_log import NotificationSentLog, NotificationType
from app.models.volunteer import VolunteerSignup, VolunteerSlot
from app.services.event_service import EventNotFoundError


def list_event_activity(db: Session, event_id: int, *, limit: int = 40) -> list[dict]:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    items: list[dict] = [
        {
            "id": f"schedule-{event.id}",
            "kind": "schedule",
            "title": "Event scheduled",
            "detail": event.title,
            "occurred_at": event.starts_at,
        }
    ]

    announcements = db.scalars(
        select(Announcement)
        .where(Announcement.event_id == event_id)
        .order_by(Announcement.created_at.desc())
        .limit(20),
    ).all()
    for row in announcements:
        items.append(
            {
                "id": f"announcement-{row.id}",
                "kind": "reminder",
                "title": "Announcement published",
                "detail": row.title,
                "occurred_at": row.created_at,
            }
        )

    checkins = db.scalars(
        select(EventCheckIn)
        .where(EventCheckIn.event_id == event_id)
        .options(selectinload(EventCheckIn.member))
        .order_by(EventCheckIn.checked_in_at.desc())
        .limit(20),
    ).all()
    for row in checkins:
        name = row.member.full_name if row.member else "Member"
        items.append(
            {
                "id": f"checkin-{row.id}",
                "kind": "invite",
                "title": "Checked in",
                "detail": name,
                "occurred_at": row.checked_in_at,
            }
        )

    rsvps = db.scalars(
        select(EventRsvp)
        .where(EventRsvp.event_id == event_id)
        .options(selectinload(EventRsvp.member))
        .order_by(EventRsvp.updated_at.desc())
        .limit(20),
    ).all()
    for row in rsvps:
        name = row.member.full_name if row.member else "Member"
        items.append(
            {
                "id": f"rsvp-{row.id}",
                "kind": "invite",
                "title": f"RSVP: {row.status.value.replace('_', ' ')}",
                "detail": name,
                "occurred_at": row.updated_at,
            }
        )

    slots = list(
        db.scalars(
            select(VolunteerSlot)
            .where(VolunteerSlot.event_id == event_id)
            .options(
                selectinload(VolunteerSlot.signups).selectinload(VolunteerSignup.member),
            ),
        ).all(),
    )
    for slot in slots:
        for signup in slot.signups:
            name = signup.member.full_name if signup.member else "Member"
            items.append(
                {
                    "id": f"slot-{signup.id}",
                    "kind": "volunteer",
                    "title": f"Claimed role: {slot.title}",
                    "detail": name,
                    "occurred_at": signup.created_at,
                }
            )

    notifications = db.scalars(
        select(NotificationSentLog)
        .where(
            NotificationSentLog.event_id == event_id,
            NotificationSentLog.success.is_(True),
            NotificationSentLog.notification_type.in_(
                [NotificationType.EVENT_REMINDER, NotificationType.RSVP_NUDGE],
            ),
        )
        .order_by(NotificationSentLog.sent_at.desc())
        .limit(10),
    ).all()
    for row in notifications:
        label = (
            "Event reminder emailed"
            if row.notification_type == NotificationType.EVENT_REMINDER
            else "RSVP nudge emailed"
        )
        items.append(
            {
                "id": f"notif-{row.id}",
                "kind": "reminder",
                "title": label,
                "detail": row.recipient_email,
                "occurred_at": row.sent_at,
            }
        )

    def sort_key(item: dict) -> datetime:
        value = item["occurred_at"]
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    items.sort(key=sort_key, reverse=True)
    return items[:limit]
