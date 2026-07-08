from unittest.mock import MagicMock

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from tests.helpers.anthropic_mocks import mock_claude_announcement_api

BOARD_REQUIRED_DETAIL = "Requires board role or higher"

VALID_PAYLOAD = {"event_name": "Dashain Celebration"}


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


def test_board_member_can_draft_announcement_email(
    client,
    board_member_headers,
    mock_claude_announcement_api,
):
    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        json=VALID_PAYLOAD,
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == "You're invited: Dashain Celebration"
    assert "Dashain Celebration" in body["body"]
    assert "NSA Connect" in body["body"]
    mock_claude_announcement_api.messages.create.assert_called_once()


def test_draft_announcement_email_never_calls_anthropic_sdk(
    client,
    board_member_headers,
    mock_claude_announcement_api,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        json=VALID_PAYLOAD,
        headers=board_member_headers,
    )

    assert response.status_code == 200
    mock_claude_announcement_api.messages.create.assert_called_once()
    block_external_integrations["anthropic_client"].assert_not_called()


def test_general_member_cannot_draft_announcement_email(
    client,
    general_member_headers,
):
    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        json=VALID_PAYLOAD,
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_draft_announcement_email_returns_503_when_ai_disabled(
    client,
    board_member_headers,
):
    with mock_claude_announcement_api(ai_enabled=False):
        response = client.post(
            "/api/v1/ai/draft-announcement-email",
            json=VALID_PAYLOAD,
            headers=board_member_headers,
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "AI features are disabled"


def test_draft_announcement_email_returns_502_for_invalid_ai_response(
    client,
    board_member_headers,
):
    with mock_claude_announcement_api() as mock_client:
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(type="text", text="not-json")],
        )

        response = client.post(
            "/api/v1/ai/draft-announcement-email",
            json=VALID_PAYLOAD,
            headers=board_member_headers,
        )

    assert response.status_code == 502
    from app.core.safe_messages import GENERIC_AI_UNAVAILABLE

    assert response.json()["detail"] == GENERIC_AI_UNAVAILABLE
    assert "anthropic" not in response.text.lower()


def test_draft_announcement_email_requires_event_name(client, board_member_headers):
    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        json={"event_name": "   "},
        headers=board_member_headers,
    )

    assert response.status_code == 422
