from datetime import UTC, datetime

from app.models.event import Event, EventType


def test_event_table_name():
    assert Event.__tablename__ == "events"


def test_event_type_values():
    assert EventType.CULTURAL.value == "cultural"
    assert EventType.MEETING.value == "meeting"
    assert EventType.FUNDRAISER.value == "fundraiser"
    assert EventType.SOCIAL.value == "social"
    assert EventType.SERVICE.value == "service"


def test_event_is_upcoming():
    future_event = Event(
        title="Dashain Celebration",
        description="Annual cultural event",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2026, 12, 1, 18, 0, tzinfo=UTC),
        created_by_id=1,
    )
    past_event = Event(
        title="General Meeting",
        description="Monthly check-in",
        event_type=EventType.MEETING,
        starts_at=datetime(2020, 1, 1, 18, 0, tzinfo=UTC),
        created_by_id=1,
    )

    assert future_event.is_upcoming is True
    assert past_event.is_upcoming is False
