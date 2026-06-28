from unittest.mock import MagicMock

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from tests.helpers.anthropic_mocks import mock_claude_checklist_api

BOARD_REQUIRED_DETAIL = "Requires board role or higher"

VALID_PAYLOAD = {
    "event_name": "Dashain Celebration",
    "event_type": "cultural",
    "tasks": ["Book cultural hall", "Order momo catering"],
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


def test_board_member_can_generate_checklist(
    client,
    board_member_headers,
    mock_claude_checklist_api,
):
    response = client.post(
        "/api/v1/ai/generate-checklist",
        json=VALID_PAYLOAD,
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["categories"][0]["category"] == "Logistics & Venue"
    assert len(body["categories"]) == 4
    task_count = sum(len(category["tasks"]) for category in body["categories"])
    assert task_count == 12
    mock_claude_checklist_api.messages.create.assert_called_once()


def test_generate_checklist_never_calls_anthropic_sdk(
    client,
    board_member_headers,
    mock_claude_checklist_api,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/ai/generate-checklist",
        json=VALID_PAYLOAD,
        headers=board_member_headers,
    )

    assert response.status_code == 200
    mock_claude_checklist_api.messages.create.assert_called_once()
    block_external_integrations["anthropic_client"].assert_not_called()


def test_general_member_cannot_generate_checklist(client, general_member_headers):
    response = client.post(
        "/api/v1/ai/generate-checklist",
        json=VALID_PAYLOAD,
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_generate_checklist_returns_503_when_ai_disabled(
    client,
    board_member_headers,
):
    with mock_claude_checklist_api(ai_enabled=False):
        response = client.post(
            "/api/v1/ai/generate-checklist",
            json=VALID_PAYLOAD,
            headers=board_member_headers,
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "AI features are disabled"


def test_generate_checklist_returns_502_for_invalid_ai_response(
    client,
    board_member_headers,
):
    with mock_claude_checklist_api() as mock_client:
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(type="text", text="not-json")],
        )

        response = client.post(
            "/api/v1/ai/generate-checklist",
            json=VALID_PAYLOAD,
            headers=board_member_headers,
        )

    assert response.status_code == 502
    assert response.json()["detail"] == "Anthropic returned invalid JSON"


def test_generate_checklist_requires_event_name(client, board_member_headers):
    response = client.post(
        "/api/v1/ai/generate-checklist",
        json={"event_name": "   ", "event_type": "cultural"},
        headers=board_member_headers,
    )

    assert response.status_code == 422


def test_generate_checklist_passes_seed_tasks_to_claude(
    client,
    board_member_headers,
    mock_claude_checklist_api,
):
    client.post(
        "/api/v1/ai/generate-checklist",
        json=VALID_PAYLOAD,
        headers=board_member_headers,
    )

    call_kwargs = mock_claude_checklist_api.messages.create.call_args.kwargs
    user_content = call_kwargs["messages"][0]["content"]
    assert "Book cultural hall" in user_content
    assert "Order momo catering" in user_content
    assert call_kwargs["model"] == "claude-sonnet-4-20250514"
