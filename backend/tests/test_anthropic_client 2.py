from unittest.mock import patch

import pytest

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
    reset_anthropic_client,
)


@pytest.fixture(autouse=True)
def clear_anthropic_client_cache():
    reset_anthropic_client()
    yield
    reset_anthropic_client()


def test_get_anthropic_client_returns_singleton(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key")
    get_settings.cache_clear()

    with patch("anthropic.Anthropic") as mock_anthropic:
        first = get_anthropic_client()
        second = get_anthropic_client()

    assert first is second
    mock_anthropic.assert_called_once_with(api_key="sk-ant-test-key")

    get_settings.cache_clear()


def test_get_anthropic_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()

    with pytest.raises(AnthropicNotConfiguredError):
        get_anthropic_client()

    get_settings.cache_clear()


def test_settings_ai_defaults():
    from app.core.config import Settings

    settings = Settings()
    assert settings.AI_ENABLED is False
    assert settings.ANTHROPIC_API_KEY == ""
    assert settings.ANTHROPIC_MODEL == "claude-sonnet-4-20250514"
