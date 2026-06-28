import json
from unittest.mock import MagicMock

import pytest

from app.models.event import EventType
from app.prompts.checklist_generator import (
    CHECKLIST_GENERATOR_SYSTEM_PROMPT,
    EVENT_TYPE_GUIDANCE,
)
from app.services.ai_checklist_service import (
    AIChecklistGenerationError,
    AIDisabledError,
    generate_event_checklist,
)
from tests.helpers.anthropic_mocks import mock_claude_checklist_api


def test_generate_event_checklist_parses_json_response():
    payload = {
        "categories": [
            {"category": "Setup", "tasks": ["Reserve room", "Test AV"]},
        ]
    }

    with mock_claude_checklist_api(payload) as mock_client:
        result = generate_event_checklist(
            event_name="General Meeting",
            event_type=EventType.MEETING,
            tasks=["Send agenda"],
        )

    assert result.categories[0].category == "Setup"
    assert result.categories[0].tasks == ["Reserve room", "Test AV"]

    call_kwargs = mock_client.messages.create.call_args.kwargs
    user_content = call_kwargs["messages"][0]["content"]
    assert call_kwargs["system"] == CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "General Meeting" in user_content
    assert "Send agenda" in user_content
    assert EVENT_TYPE_GUIDANCE[EventType.MEETING] in user_content


def test_generate_event_checklist_raises_when_ai_disabled():
    with mock_claude_checklist_api(ai_enabled=False):
        with pytest.raises(AIDisabledError):
            generate_event_checklist(
                event_name="Fundraiser Night",
                event_type=EventType.FUNDRAISER,
            )


def test_generate_event_checklist_strips_json_code_fence():
    payload = {
        "categories": [
            {"category": "Marketing", "tasks": ["Design flyers"]},
        ]
    }
    fenced = f"```json\n{json.dumps(payload)}\n```"

    with mock_claude_checklist_api() as mock_client:
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(type="text", text=fenced)],
        )

        result = generate_event_checklist(
            event_name="Social Mixer",
            event_type=EventType.SOCIAL,
        )

    assert result.categories[0].tasks == ["Design flyers"]


def test_generate_event_checklist_raises_for_empty_categories():
    with mock_claude_checklist_api({"categories": []}):
        with pytest.raises(AIChecklistGenerationError, match="no checklist categories"):
            generate_event_checklist(
                event_name="Service Day",
                event_type=EventType.SERVICE,
            )
