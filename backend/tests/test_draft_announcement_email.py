from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event
from app.models.organization import Organization, OrganizationStatus
from app.services.organization_context import get_default_organization_id
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


def test_draft_uses_stored_utc_event_instead_of_the_client_clock(
    client,
    board_member_headers,
    db_session,
):
    created = client.post(
        "/api/v1/events",
        headers=board_member_headers,
        json={
            "name": "Nepali Cultural Night 2026",
            "starts_at": "2030-03-15T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Food, music, and dance.",
            "location": "UC ballroom",
            "budget": "0.00",
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]
    stored = db_session.get(Event, event_id)
    stored.starts_at = datetime(2026, 11, 28, 0, 0, tzinfo=UTC)
    stored.ends_at = datetime(2026, 11, 28, 3, 0, tzinfo=UTC)
    db_session.commit()

    payload = {
        "subject": "See you Saturday",
        "body": (
            "Saturday, November 28 starts at midnight.\n\n"
            "Admission: $15\n\n"
            "Bring your friends."
        ),
    }
    with mock_claude_announcement_api(payload) as mock_client:
        response = client.post(
            "/api/v1/ai/draft-announcement-email",
            headers=board_member_headers,
            json={
                "event_name": "Wrong name",
                "starts_at": "2026-11-28T18:00:00+00:00",
                "location": "Wrong room",
                "event_id": event_id,
            },
        )

    assert response.status_code == 200
    body = response.json()["body"]
    assert "Nepali Cultural Night 2026" in body
    assert "Friday, November 27, 2026 at 6:00 PM CST" in body
    assert "Friday, November 27, 2026 at 9:00 PM CST" in body
    assert "Where: UC ballroom" in body
    assert f"/events/{event_id}" in body
    assert "Saturday" not in body
    assert "Wrong room" not in body
    assert "$15" not in body
    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "2026-11-28T00:00:00" not in prompt
    assert "Wrong room" not in prompt
    stored_again = db_session.scalar(select(Event).where(Event.id == event_id))
    stored_start = stored_again.starts_at
    if stored_start.tzinfo is None:
        stored_start = stored_start.replace(tzinfo=UTC)
    assert stored_start.astimezone(UTC) == datetime(2026, 11, 28, 0, 0, tzinfo=UTC)


def test_draft_for_another_organization_event_is_not_found(
    client,
    board_member_headers,
    db_session,
):
    created = client.post(
        "/api/v1/events",
        headers=board_member_headers,
        json={
            "name": "Other chapter night",
            "starts_at": "2030-03-15T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Private to the other chapter.",
            "budget": "0.00",
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]
    default_org = db_session.get(Organization, get_default_organization_id(db_session))
    other = Organization(
        university_id=default_org.university_id,
        name="Other Chapter",
        slug="other-chapter",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.flush()
    stored = db_session.get(Event, event_id)
    stored.organization_id = other.id
    db_session.commit()

    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        headers=board_member_headers,
        json={"event_name": "Other chapter night", "event_id": event_id},
    )
    assert response.status_code == 404


def test_draft_announcement_email_requires_event_name(client, board_member_headers):
    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        json={"event_name": "   "},
        headers=board_member_headers,
    )

    assert response.status_code == 422
