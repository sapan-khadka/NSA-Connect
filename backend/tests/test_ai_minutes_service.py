import pytest

from app.prompts.meeting_minutes import MEETING_MINUTES_SYSTEM_PROMPT
from app.services.ai_checklist_service import AIDisabledError
from app.services.ai_minutes_service import (
    AIMinutesSummaryError,
    summarize_meeting_minutes,
)
from tests.helpers.anthropic_mocks import mock_claude_minutes_api


def test_summarize_meeting_minutes_parses_json_response():
    payload = {
        "summary": "The board reviewed upcoming events.",
        "key_decisions": ["Approved social event budget."],
        "action_items": [
            {"task": "Post flyer on Instagram", "owner": "Marketing", "due": None},
        ],
    }

    with mock_claude_minutes_api(payload) as mock_client:
        result = summarize_meeting_minutes(
            notes="social budget ok. marketing post flyer",
            meeting_title="April board meeting",
        )

    assert "reviewed upcoming events" in result.summary
    assert result.key_decisions == ["Approved social event budget."]
    assert result.action_items[0].task == "Post flyer on Instagram"
    assert result.action_items[0].owner == "Marketing"

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["system"] == MEETING_MINUTES_SYSTEM_PROMPT
    assert "April board meeting" in call_kwargs["messages"][0]["content"]


def test_summarize_meeting_minutes_raises_when_ai_disabled():
    with mock_claude_minutes_api(ai_enabled=False):
        with pytest.raises(AIDisabledError):
            summarize_meeting_minutes(notes="quick standup notes")


def test_summarize_meeting_minutes_raises_for_empty_summary():
    with mock_claude_minutes_api(
        {"summary": "   ", "key_decisions": [], "action_items": []},
    ):
        with pytest.raises(AIMinutesSummaryError, match="empty summary"):
            summarize_meeting_minutes(notes="notes")
