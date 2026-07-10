"""OpenAI vision mocks for receipt scan tests — no real API calls."""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

SETTINGS_PATCH = "app.services.receipt_scan_service.get_settings"
CLIENT_PATCH = "app.services.receipt_scan_service.get_openai_client"
DEFAULT_VISION_MODEL = "gpt-4o-mini"

SAMPLE_RECEIPT_SCAN_PAYLOAD = {
    "is_receipt": True,
    "vendor": "Walmart",
    "purchase_date": "2026-03-15",
    "purchase_time": "14:32",
    "amount": "24.67",
    "description": "Milk, bread, eggs",
    "category": "food_beverage",
    "confidence": "high",
}

UNREADABLE_RECEIPT_SCAN_PAYLOAD = {
    "is_receipt": False,
    "vendor": None,
    "purchase_date": None,
    "purchase_time": None,
    "amount": None,
    "description": None,
    "category": None,
    "confidence": "low",
}


def build_mock_openai_completion(payload: dict) -> MagicMock:
    return MagicMock(
        choices=[
            MagicMock(
                message=MagicMock(content=json.dumps(payload)),
            )
        ]
    )


def build_mock_openai_client(payload: dict) -> MagicMock:
    mock_client = MagicMock(name="openai_client")
    mock_client.chat.completions.create.return_value = build_mock_openai_completion(
        payload
    )
    return mock_client


@contextmanager
def mock_openai_receipt_scan_api(
    payload: dict | None = None,
    *,
    ai_enabled: bool = True,
) -> Iterator[MagicMock]:
    mock_client = build_mock_openai_client(payload or SAMPLE_RECEIPT_SCAN_PAYLOAD)
    with (
        patch(SETTINGS_PATCH) as mock_settings,
        patch(CLIENT_PATCH, return_value=mock_client),
    ):
        mock_settings.return_value.AI_ENABLED = ai_enabled
        mock_settings.return_value.OPENAI_VISION_MODEL = DEFAULT_VISION_MODEL
        mock_settings.return_value.OPENAI_API_KEY = "sk-test-key"
        yield mock_client
