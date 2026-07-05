from sqlalchemy.orm import Session

from app.models.member import Member
from app.schemas.notification_preferences import (
    NotificationPreferencesResponse,
    NotificationPreferencesUpdateRequest,
)
from app.services.member_service import MemberNotFoundError

_PREFERENCE_FIELD_MAP = {
    "event_reminders": "notify_event_reminders",
    "rsvp_nudges": "notify_rsvp_nudges",
    "task_reminders": "notify_task_reminders",
    "dues_reminders": "notify_dues_reminders",
    "announcements": "notify_announcements",
}


def preferences_from_member(member: Member) -> NotificationPreferencesResponse:
    return NotificationPreferencesResponse(
        event_reminders=member.notify_event_reminders,
        rsvp_nudges=member.notify_rsvp_nudges,
        task_reminders=member.notify_task_reminders,
        dues_reminders=member.notify_dues_reminders,
        announcements=member.notify_announcements,
    )


def get_notification_preferences(db: Session, member_id: int) -> NotificationPreferencesResponse:
    member = db.get(Member, member_id)
    if member is None:
        raise MemberNotFoundError
    return preferences_from_member(member)


def update_notification_preferences(
    db: Session,
    member_id: int,
    data: NotificationPreferencesUpdateRequest,
) -> NotificationPreferencesResponse:
    member = db.get(Member, member_id)
    if member is None:
        raise MemberNotFoundError

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        column = _PREFERENCE_FIELD_MAP[field]
        setattr(member, column, value)

    db.commit()
    db.refresh(member)
    return preferences_from_member(member)
