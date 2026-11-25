from datetime import UTC, datetime

import pytest

from app.models.event import EventType
from app.prompts.announcement_email import ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT
from app.services.ai_announcement_service import (
    AIAnnouncementDraftError,
    draft_event_announcement_email,
)
from app.services.ai_checklist_service import AIDisabledError
from tests.helpers.anthropic_mocks import mock_claude_announcement_api


def test_draft_event_announcement_email_parses_json_response():
    payload = {
        "subject": "Spring Social this Friday",
        "body": "Hi NSA members,\n\nJoin us for Spring Social.\n\nBest,\nNSA",
    }

    with mock_claude_announcement_api(payload) as mock_client:
        result = draft_event_announcement_email(event_name="Spring Social")

    assert result.subject == "Spring Social"
    assert "Spring Social" in result.body
    assert "[Date]" not in result.body
    assert "[RSVP LINK]" not in result.body
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["system"] == ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT
    content = call_kwargs["messages"][0]["content"]
    assert "Spring Social" in content
    assert "Starts at:" not in content


def test_draft_event_announcement_email_raises_when_ai_disabled():
    with mock_claude_announcement_api(ai_enabled=False):
        with pytest.raises(AIDisabledError):
            draft_event_announcement_email(
                event_name="Fundraiser Night",
                event_type=EventType.FUNDRAISER,
            )


def test_draft_uses_local_event_facts_and_drops_invented_details():
    payload = {
        "subject": "Saturday night at the ballroom",
        "body": (
            "Join us on Saturday, November 28 for a late show.\n\n"
            "Admission: $10\n"
            "Contact: board@example.com\n"
            "RSVP: [RSVP LINK]\n"
            "Open to alumni only.\n\n"
            "Bring your friends for music and food.\n\n"
            "Best,\n"
            "Nepalese Students' Association (NSA Connect)"
        ),
    }

    with mock_claude_announcement_api(payload):
        result = draft_event_announcement_email(
            event_name="Nepali Cultural Night 2026",
            starts_at=datetime(2026, 11, 28, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 11, 28, 3, 0, tzinfo=UTC),
            location="UC ballroom",
            event_url="https://frontend.example/events/42",
        )

    assert result.subject == "Nepali Cultural Night 2026"
    assert "Nepali Cultural Night 2026" in result.body
    assert "Friday, November 27, 2026 at 6:00 PM CST" in result.body
    assert "Friday, November 27, 2026 at 9:00 PM CST" in result.body
    assert "Where: UC ballroom" in result.body
    assert "RSVP: https://frontend.example/events/42" in result.body
    assert "Saturday" not in result.body
    assert "November 28" not in result.body
    assert "$10" not in result.body
    assert "board@example.com" not in result.body
    assert "[RSVP LINK]" not in result.body
    assert "alumni" not in result.body
    assert "music and food" in result.body


def test_draft_omits_details_that_were_not_provided():
    payload = {
        "subject": "You're invited: Spring Social",
        "body": "Come spend the evening with NSA.\n\nBest,\nNSA Connect",
    }

    with mock_claude_announcement_api(payload):
        result = draft_event_announcement_email(
            event_name="Spring Social",
            starts_at=datetime(2026, 11, 28, 0, 0, tzinfo=UTC),
        )

    assert "When: Friday, November 27, 2026 at 6:00 PM CST" in result.body
    assert "Ends:" not in result.body
    assert "Where:" not in result.body
    assert "RSVP:" not in result.body
    assert "[Date]" not in result.body
    assert "[Time]" not in result.body


def test_draft_event_announcement_email_raises_for_empty_body():
    with mock_claude_announcement_api({"subject": "Hello", "body": "   "}):
        with pytest.raises(AIAnnouncementDraftError, match="empty announcement"):
            draft_event_announcement_email(event_name="Empty Draft")
