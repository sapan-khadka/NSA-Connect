from unittest.mock import MagicMock, patch

import pytest
from conftest import auth_header, register_member, set_member_approved

from tests.helpers.anthropic_mocks import (
    CHAT_CLIENT_PATCH,
    CHAT_SETTINGS_PATCH,
    build_mock_anthropic_text_response,
    build_mock_anthropic_tool_use_response,
)


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def _chat_settings_mock() -> MagicMock:
    settings = MagicMock()
    settings.AI_ENABLED = True
    settings.ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
    settings.ANTHROPIC_API_KEY = "sk-ant-test-key"
    settings.AI_CHAT_RAG_CHUNK_LIMIT = 5
    return settings


def _build_stream_context(
    *,
    text_chunks: list[str],
    final_message: MagicMock,
) -> MagicMock:
    context = MagicMock()
    context.__enter__.return_value = context
    context.__exit__.return_value = None
    context.text_stream = iter(text_chunks)
    context.get_final_message.return_value = final_message
    return context


def test_chat_stream_emits_tokens_metadata_and_done(
    client,
    general_member_headers,
    monkeypatch,
):
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_constitution_chunks",
        lambda *args, **kwargs: [],
    )

    mock_chat_client = MagicMock(name="anthropic_chat_client")
    mock_chat_client.messages.stream.return_value = _build_stream_context(
        text_chunks=["According ", "to the constitution."],
        final_message=build_mock_anthropic_text_response(
            "According to the constitution.",
        ),
    )

    with (
        patch(CHAT_SETTINGS_PATCH, return_value=_chat_settings_mock()),
        patch(CHAT_CLIENT_PATCH, return_value=mock_chat_client),
    ):
        with client.stream(
            "POST",
            "/api/v1/ai/chat/stream",
            headers=general_member_headers,
            json={"message": "What are officer duties?"},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

    assert "event: status" in body
    assert "event: token" in body
    assert '"text": "According "' in body
    assert '"text": "to the constitution."' in body
    assert "event: metadata" in body
    assert "constitution_sources" in body
    assert "event: done" in body


def test_chat_stream_emits_error_event_when_ai_disabled(
    client,
    general_member_headers,
):
    disabled_settings = _chat_settings_mock()
    disabled_settings.AI_ENABLED = False

    with patch(CHAT_SETTINGS_PATCH, return_value=disabled_settings):
        with client.stream(
            "POST",
            "/api/v1/ai/chat/stream",
            headers=general_member_headers,
            json={"message": "Anything?"},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

    assert "event: error" in body
    assert "AI features are disabled" in body


def test_chat_stream_handles_tool_use_before_final_tokens(
    client,
    general_member_headers,
    monkeypatch,
):
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_constitution_chunks",
        lambda *args, **kwargs: [],
    )

    mock_chat_client = MagicMock(name="anthropic_chat_client")
    mock_chat_client.messages.stream.side_effect = [
        _build_stream_context(
            text_chunks=[],
            final_message=build_mock_anthropic_tool_use_response(
                tool_name="list_upcoming_events",
                tool_input={"limit": 3},
            ),
        ),
        _build_stream_context(
            text_chunks=["One upcoming event found."],
            final_message=build_mock_anthropic_text_response(
                "One upcoming event found.",
            ),
        ),
    ]

    with (
        patch(CHAT_SETTINGS_PATCH, return_value=_chat_settings_mock()),
        patch(CHAT_CLIENT_PATCH, return_value=mock_chat_client),
    ):
        with client.stream(
            "POST",
            "/api/v1/ai/chat/stream",
            headers=general_member_headers,
            json={"message": "What events are coming up?"},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

    assert "event: token" in body
    assert "One upcoming event found." in body
    assert "list_upcoming_events" in body
    assert mock_chat_client.messages.stream.call_count == 2
