"""Shared Anthropic/Claude mocks for tests — no real API calls."""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

SETTINGS_PATCH = "app.services.ai_checklist_service.get_settings"
CLIENT_PATCH = "app.services.ai_checklist_service.get_anthropic_client"
ANNOUNCEMENT_SETTINGS_PATCH = "app.services.ai_announcement_service.get_settings"
ANNOUNCEMENT_CLIENT_PATCH = "app.services.ai_announcement_service.get_anthropic_client"
MINUTES_SETTINGS_PATCH = "app.services.ai_minutes_service.get_settings"
MINUTES_CLIENT_PATCH = "app.services.ai_minutes_service.get_anthropic_client"
ANTHROPIC_CLASS_PATCH = "app.integrations.anthropic_client.Anthropic"
DEFAULT_MODEL = "claude-sonnet-4-20250514"

SAMPLE_CHECKLIST_PAYLOAD = {
    "categories": [
        {
            "category": "Logistics & Venue",
            "tasks": [
                "Reserve student center room",
                "Confirm AV equipment",
                "Create day-of setup timeline",
            ],
        },
        {
            "category": "Food & Beverage",
            "tasks": [
                "Collect dietary restrictions from RSVPs",
                "Place catering order",
                "Confirm serving supplies",
            ],
        },
        {
            "category": "Marketing & Outreach",
            "tasks": [
                "Design Instagram flyer",
                "Post RSVP link to group chat",
                "Send reminder email day before event",
            ],
        },
        {
            "category": "Finance & Budget",
            "tasks": [
                "Confirm budget approval with treasurer",
                "Track deposits and reimbursements",
                "Reconcile receipts after event",
            ],
        },
    ]
}

SAMPLE_ANNOUNCEMENT_PAYLOAD = {
    "subject": "You're invited: Dashain Celebration",
    "body": (
        "Hi NSA members,\n\n"
        "Join us for Dashain Celebration — an evening of food, music, "
        "and community.\n\n"
        "When: [Date] at [Time]\n"
        "Where: [Location]\n\n"
        "RSVP in NSA Connect: [RSVP LINK]\n\n"
        "Best,\n"
        "Nepalese Students' Association (NSA Connect)"
    ),
}


SAMPLE_MINUTES_PAYLOAD = {
    "summary": (
        "The board met to plan the spring semester calendar and review finances.\n\n"
        "Members agreed to prioritize Dashain Celebration and a general meeting in "
        "September."
    ),
    "key_decisions": [
        "Approved Dashain Celebration for early October.",
        "Treasurer will share updated budget at the next meeting.",
    ],
    "action_items": [
        {
            "task": "Reserve University Center room for Dashain",
            "owner": "Events chair",
            "due": "By March 15",
        },
        {
            "task": "Send updated budget spreadsheet to board",
            "owner": "Treasurer",
            "due": None,
        },
    ],
}


def build_mock_anthropic_response(payload: dict) -> MagicMock:
    return MagicMock(
        content=[MagicMock(type="text", text=json.dumps(payload))],
    )


def build_mock_anthropic_client(payload: dict) -> MagicMock:
    mock_client = MagicMock(name="anthropic_client")
    mock_client.messages.create.return_value = build_mock_anthropic_response(payload)
    return mock_client


@contextmanager
def mock_claude_json_api(
    *,
    settings_patch: str,
    client_patch: str,
    payload: dict,
    ai_enabled: bool = True,
) -> Iterator[MagicMock]:
    """Patch an AI service settings/client pair; never calls Anthropic."""
    mock_client = build_mock_anthropic_client(payload)
    with (
        patch(settings_patch) as mock_settings,
        patch(client_patch, return_value=mock_client),
    ):
        mock_settings.return_value.AI_ENABLED = ai_enabled
        mock_settings.return_value.ANTHROPIC_MODEL = DEFAULT_MODEL
        mock_settings.return_value.ANTHROPIC_API_KEY = "sk-ant-test-key"
        yield mock_client


@contextmanager
def mock_claude_checklist_api(
    payload: dict | None = None,
    *,
    ai_enabled: bool = True,
) -> Iterator[MagicMock]:
    with mock_claude_json_api(
        settings_patch=SETTINGS_PATCH,
        client_patch=CLIENT_PATCH,
        payload=payload or SAMPLE_CHECKLIST_PAYLOAD,
        ai_enabled=ai_enabled,
    ) as mock_client:
        yield mock_client


@contextmanager
def mock_claude_announcement_api(
    payload: dict | None = None,
    *,
    ai_enabled: bool = True,
) -> Iterator[MagicMock]:
    with mock_claude_json_api(
        settings_patch=ANNOUNCEMENT_SETTINGS_PATCH,
        client_patch=ANNOUNCEMENT_CLIENT_PATCH,
        payload=payload or SAMPLE_ANNOUNCEMENT_PAYLOAD,
        ai_enabled=ai_enabled,
    ) as mock_client:
        yield mock_client


@contextmanager
def mock_claude_minutes_api(
    payload: dict | None = None,
    *,
    ai_enabled: bool = True,
) -> Iterator[MagicMock]:
    with mock_claude_json_api(
        settings_patch=MINUTES_SETTINGS_PATCH,
        client_patch=MINUTES_CLIENT_PATCH,
        payload=payload or SAMPLE_MINUTES_PAYLOAD,
        ai_enabled=ai_enabled,
    ) as mock_client:
        yield mock_client
