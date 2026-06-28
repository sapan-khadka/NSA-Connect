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

    assert result.subject == "Spring Social this Friday"
    assert "Spring Social" in result.body
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["system"] == ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT
    assert "Spring Social" in call_kwargs["messages"][0]["content"]


def test_draft_event_announcement_email_raises_when_ai_disabled():
    with mock_claude_announcement_api(ai_enabled=False):
        with pytest.raises(AIDisabledError):
            draft_event_announcement_email(
                event_name="Fundraiser Night",
                event_type=EventType.FUNDRAISER,
            )


def test_draft_event_announcement_email_raises_for_empty_body():
    with mock_claude_announcement_api({"subject": "Hello", "body": "   "}):
        with pytest.raises(AIAnnouncementDraftError, match="empty announcement"):
            draft_event_announcement_email(event_name="Empty Draft")
