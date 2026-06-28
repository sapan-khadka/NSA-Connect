from datetime import UTC, datetime

from app.models.event import EventType
from app.prompts.announcement_email import (
    ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT,
    EVENT_TYPE_ANNOUNCEMENT_FOCUS,
    build_announcement_user_prompt,
)


def test_system_prompt_defines_email_output_contract():
    assert "NSA Connect" in ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT
    assert '"subject"' in ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT
    assert '"body"' in ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT
    assert "Return ONLY valid JSON" in ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT


def test_event_type_announcement_focus_covers_every_event_type():
    assert set(EVENT_TYPE_ANNOUNCEMENT_FOCUS) == set(EventType)


def test_build_announcement_user_prompt_requires_only_event_name():
    prompt = build_announcement_user_prompt(event_name="Dashain Celebration")

    assert "Event name: Dashain Celebration" in prompt
    assert "Return the announcement JSON only." in prompt
    assert "Event type:" not in prompt


def test_build_announcement_user_prompt_includes_optional_context():
    prompt = build_announcement_user_prompt(
        event_name="General Meeting",
        event_type=EventType.MEETING,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        location="University Center Room 204",
        description="Agenda includes budget review.",
    )

    assert "Event type: meeting" in prompt
    assert EVENT_TYPE_ANNOUNCEMENT_FOCUS[EventType.MEETING] in prompt
    assert "Starts at: 2030-06-01T18:00:00+00:00" in prompt
    assert "Location: University Center Room 204" in prompt
    assert "Agenda includes budget review." in prompt
