import pytest

from app.prompts.meeting_minutes import MEETING_MINUTES_SYSTEM_PROMPT
from app.services.ai_checklist_service import AIDisabledError
from app.services.ai_minutes_service import (
    AIMinutesSummaryError,
    summarize_meeting_minutes,
)
from tests.helpers.anthropic_mocks import mock_claude_minutes_api


def test_summarize_meeting_minutes_parses_json_response():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    payload = {
        "summary": "The board reviewed upcoming events.",
        "key_decisions": [
            {
                "text": "Approved the social event budget.",
                "evidence": "approved the social event budget",
            }
        ],
        "action_items": [
            {
                "task": "Post flyer on Instagram",
                "owner": "Marketing",
                "due": "2024-11-26",
                "evidence": "marketing post flyer by November 26",
            }
        ],
    }
    notes = "Approved the social event budget. Marketing post flyer by November 26."

    with mock_claude_minutes_api(payload) as mock_client:
        result = summarize_meeting_minutes(
            notes=notes,
            meeting_title="November board meeting",
            starts_at=datetime(2026, 11, 20, 18, 0, tzinfo=ZoneInfo("America/Chicago")),
        )

    assert "reviewed upcoming events" in result.summary
    assert result.key_decisions == ["Approved the social event budget."]
    assert result.action_items[0].task == "Post flyer on Instagram"
    assert result.action_items[0].owner == "Marketing"
    assert result.action_items[0].due == "2026-11-26"

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["system"] == MEETING_MINUTES_SYSTEM_PROMPT
    content = call_kwargs["messages"][0]["content"]
    assert "November board meeting" in content
    assert "November 20, 2026" in content
    assert "2026" in content
    assert "America/Chicago" in content


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
