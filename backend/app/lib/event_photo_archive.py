from app.models.event import EventType


def default_show_in_photo_archive(event_type: EventType) -> bool:
    """Meetings are hidden from the photo archive by default; others are shown."""
    return event_type != EventType.MEETING
