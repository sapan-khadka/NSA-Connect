import pytest
from unittest.mock import patch

from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from app.models.member import Member

VALID_EMAIL = "sapan@semo.edu"


@pytest.fixture
def member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_notification_preferences_default_to_on(client, member_headers, db_session):
    member = db_session.query(Member).filter(Member.email == VALID_EMAIL).one()
    assert member.notify_event_reminders is True
    assert member.notify_rsvp_nudges is True
    assert member.notify_task_reminders is True
    assert member.notify_dues_reminders is True
    assert member.notify_announcements is True

    response = client.get("/api/v1/notifications/preferences", headers=member_headers)
    assert response.status_code == 200
    assert response.json() == {
        "event_reminders": True,
        "rsvp_nudges": True,
        "task_reminders": True,
        "dues_reminders": True,
        "announcements": True,
    }


def test_member_can_update_own_notification_preferences(client, member_headers):
    response = client.patch(
        "/api/v1/notifications/preferences",
        headers=member_headers,
        json={"event_reminders": False, "task_reminders": False},
    )
    assert response.status_code == 200
    assert response.json() == {
        "event_reminders": False,
        "rsvp_nudges": True,
        "task_reminders": False,
        "dues_reminders": True,
        "announcements": True,
    }

    fetched = client.get("/api/v1/notifications/preferences", headers=member_headers)
    assert fetched.json()["event_reminders"] is False


def test_general_member_cannot_send_test_email(client, member_headers):
    response = client.post("/api/v1/notifications/test-email", headers=member_headers)
    assert response.status_code == 403


@patch("app.api.v1.notifications.send_test_email")
def test_board_can_send_test_email(mock_send, client, board_headers):
    mock_send.return_value = "email_123"

    response = client.post(
        "/api/v1/notifications/test-email",
        headers=board_headers,
        json={"to_email": "sapankhadka110@gmail.com"},
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "sapankhadka110@gmail.com" in response.json()["message"]
    mock_send.assert_called_once_with(to_email="sapankhadka110@gmail.com")


def test_test_email_rejects_invalid_address(client, board_headers):
    response = client.post(
        "/api/v1/notifications/test-email",
        headers=board_headers,
        json={"to_email": "not-an-email"},
    )

    assert response.status_code == 422


@patch("app.services.resend_email_service.send_email")
@patch("app.services.resend_email_service.settings")
def test_send_resend_email_uses_api_key_from_settings(mock_settings, mock_send):
    from app.integrations.resend_client import ResendDeliveryError
    from app.services.resend_email_service import send_resend_email

    mock_settings.RESEND_API_KEY = "re_test_key"
    mock_settings.RESEND_FROM_EMAIL = "NSA Connect <onboarding@resend.dev>"
    mock_settings.EMAIL_TEST_OVERRIDE_RECIPIENT = ""
    mock_send.return_value = "email_abc"

    email_id = send_resend_email(
        to_email="test@semo.edu",
        subject="Test",
        body="Hello",
    )

    assert email_id == "email_abc"
    mock_send.assert_called_once_with(
        api_key="re_test_key",
        from_email="NSA Connect <onboarding@resend.dev>",
        to_email="test@semo.edu",
        subject="Test",
        body="Hello",
        body_format="text",
    )


@patch("app.services.resend_email_service.settings")
def test_send_resend_email_fails_without_api_key(mock_settings):
    from app.integrations.resend_client import ResendDeliveryError
    from app.services.resend_email_service import send_resend_email

    mock_settings.RESEND_API_KEY = ""

    with pytest.raises(ResendDeliveryError, match="RESEND_API_KEY is not configured"):
        send_resend_email(
            to_email="test@semo.edu",
            subject="Test",
            body="Hello",
        )


@patch("app.services.resend_email_service.send_email")
@patch("app.services.resend_email_service.settings")
def test_send_resend_email_redirects_when_test_override_set(mock_settings, mock_send):
    from app.services.resend_email_service import send_resend_email

    mock_settings.RESEND_API_KEY = "re_test_key"
    mock_settings.RESEND_FROM_EMAIL = "NSA Connect <onboarding@resend.dev>"
    mock_settings.EMAIL_TEST_OVERRIDE_RECIPIENT = "sapankhadka110@gmail.com"
    mock_send.return_value = "email_abc"

    send_resend_email(
        to_email="mukesh@semo.edu",
        subject="Task assigned: Buy supplies",
        body="Hi Mukesh,\n\nYou've been assigned a task.",
    )

    mock_send.assert_called_once_with(
        api_key="re_test_key",
        from_email="NSA Connect <onboarding@resend.dev>",
        to_email="sapankhadka110@gmail.com",
        subject="Task assigned: Buy supplies",
        body="Hi Mukesh,\n\nYou've been assigned a task.",
        body_format="text",
    )


@patch("app.services.resend_email_service.send_email")
@patch("app.services.resend_email_service.settings")
def test_send_resend_email_skips_redirect_when_override_unset(mock_settings, mock_send):
    from app.services.resend_email_service import send_resend_email

    mock_settings.RESEND_API_KEY = "re_test_key"
    mock_settings.RESEND_FROM_EMAIL = "NSA Connect <onboarding@resend.dev>"
    mock_settings.EMAIL_TEST_OVERRIDE_RECIPIENT = ""
    mock_send.return_value = "email_abc"

    send_resend_email(
        to_email="mukesh@semo.edu",
        subject="Task assigned: Buy supplies",
        body="Hi Mukesh,\n\nYou've been assigned a task.",
    )

    mock_send.assert_called_once_with(
        api_key="re_test_key",
        from_email="NSA Connect <onboarding@resend.dev>",
        to_email="mukesh@semo.edu",
        subject="Task assigned: Buy supplies",
        body="Hi Mukesh,\n\nYou've been assigned a task.",
        body_format="text",
    )


@patch("app.api.v1.notifications.send_test_email")
def test_test_email_endpoint_returns_resend_error_message(mock_send, client, board_headers):
    from app.integrations.resend_client import ResendDeliveryError

    mock_send.side_effect = ResendDeliveryError("Invalid API key")

    response = client.post(
        "/api/v1/notifications/test-email",
        headers=board_headers,
        json={"to_email": "test@semo.edu"},
    )

    assert response.status_code == 502
    assert "Failed to send test email" in response.json()["detail"]
