from unittest.mock import MagicMock

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from tests.helpers.anthropic_mocks import mock_claude_minutes_api

BOARD_REQUIRED_DETAIL = "Requires board role or higher"

VALID_PAYLOAD = {
    "notes": (
        "dashain oct - sapan reserve room\n"
        "treasurer send budget sheet\n"
        "approved dashain date"
    ),
    "meeting_title": "March Board Meeting",
}


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_board_member_can_summarize_minutes(
    client,
    board_member_headers,
    mock_claude_minutes_api,
):
    response = client.post(
        "/api/v1/ai/summarize-minutes",
        json=VALID_PAYLOAD,
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert "spring semester" in body["summary"].lower()
    assert len(body["key_decisions"]) == 2
    assert len(body["action_items"]) == 2
    assert (
        body["action_items"][0]["task"] == "Reserve University Center room for Dashain"
    )
    mock_claude_minutes_api.messages.create.assert_called_once()


def test_summarize_minutes_never_calls_anthropic_sdk(
    client,
    board_member_headers,
    mock_claude_minutes_api,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/ai/summarize-minutes",
        json={"notes": "quick notes from tonight"},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    mock_claude_minutes_api.messages.create.assert_called_once()
    block_external_integrations["anthropic_client"].assert_not_called()


def test_general_member_cannot_summarize_minutes(client, general_member_headers):
    response = client.post(
        "/api/v1/ai/summarize-minutes",
        json={"notes": "board only"},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_summarize_minutes_returns_503_when_ai_disabled(
    client,
    board_member_headers,
):
    with mock_claude_minutes_api(ai_enabled=False):
        response = client.post(
            "/api/v1/ai/summarize-minutes",
            json={"notes": "notes"},
            headers=board_member_headers,
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "AI features are disabled"


def test_summarize_minutes_returns_502_for_invalid_ai_response(
    client,
    board_member_headers,
):
    with mock_claude_minutes_api() as mock_client:
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(type="text", text="not-json")],
        )

        response = client.post(
            "/api/v1/ai/summarize-minutes",
            json={"notes": "notes"},
            headers=board_member_headers,
        )

    assert response.status_code == 502
    from app.core.safe_messages import GENERIC_AI_UNAVAILABLE

    assert response.json()["detail"] == GENERIC_AI_UNAVAILABLE
    assert "anthropic" not in response.text.lower()


def test_summarize_minutes_requires_notes(client, board_member_headers):
    response = client.post(
        "/api/v1/ai/summarize-minutes",
        json={"notes": "   "},
        headers=board_member_headers,
    )

    assert response.status_code == 422
