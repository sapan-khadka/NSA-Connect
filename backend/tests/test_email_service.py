import logging
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from app.services.email_service import (
    MEETING_MINUTES_READY_SUBJECT,
    WELCOME_EMAIL_SUBJECT,
    build_meeting_record_notification_email_body,
    build_prep_task_due_soon_email_body,
    build_volunteer_task_assigned_email_body,
    build_welcome_email_body,
    send_meeting_record_notification_email,
    send_prep_task_due_soon_email,
    send_volunteer_task_assigned_email,
    send_welcome_email,
)


def test_build_welcome_email_body_includes_member_name():
    body = build_welcome_email_body(full_name="Test User")

    assert "Hi Test User," in body
    assert "approved" in body


def test_send_welcome_email_skips_when_disabled(caplog):
    with caplog.at_level(logging.INFO):
        send_welcome_email(email="test@semo.edu", full_name="Test User")

    assert "Welcome email (disabled)" in caplog.text
    assert "test@semo.edu" in caplog.text


@patch("app.services.email_service.settings")
def test_send_welcome_email_logs_when_api_key_missing(mock_settings, caplog):
    mock_settings.EMAIL_ENABLED = True
    mock_settings.SENDGRID_API_KEY = ""

    with caplog.at_level(logging.ERROR):
        send_welcome_email(email="test@semo.edu", full_name="Test User")

    assert "SENDGRID_API_KEY is missing" in caplog.text


@patch("app.services.email_service.send_email")
@patch("app.services.email_service.settings")
def test_send_welcome_email_sends_via_sendgrid_when_enabled(
    mock_settings,
    mock_send_email,
    caplog,
):
    mock_settings.EMAIL_ENABLED = True
    mock_settings.SENDGRID_API_KEY = "sg.test-key"
    mock_settings.EMAIL_FROM = "NSA Connect <noreply@semo.edu>"

    with caplog.at_level(logging.INFO):
        send_welcome_email(email="test@semo.edu", full_name="Test User")

    mock_send_email.assert_called_once_with(
        api_key="sg.test-key",
        from_email="NSA Connect <noreply@semo.edu>",
        to_email="test@semo.edu",
        subject=WELCOME_EMAIL_SUBJECT,
        body=build_welcome_email_body(full_name="Test User"),
    )
    assert "Welcome email sent via SendGrid" in caplog.text


@patch("app.services.email_service.send_email")
@patch("app.services.email_service.settings")
def test_send_welcome_email_logs_sendgrid_failure_without_raising(
    mock_settings,
    mock_send_email,
    caplog,
):
    from app.integrations.sendgrid_client import SendGridDeliveryError

    mock_settings.EMAIL_ENABLED = True
    mock_settings.SENDGRID_API_KEY = "sg.test-key"
    mock_settings.EMAIL_FROM = "NSA Connect <noreply@semo.edu>"
    mock_send_email.side_effect = SendGridDeliveryError("SendGrid returned 500")

    with caplog.at_level(logging.ERROR):
        send_welcome_email(email="test@semo.edu", full_name="Test User")

    assert "SendGrid failed to deliver welcome email" in caplog.text


@patch("app.integrations.sendgrid_client.SendGridAPIClient")
def test_sendgrid_client_sends_mail(mock_client_class):
    from app.integrations.sendgrid_client import send_email

    response = MagicMock(status_code=202, body="accepted")
    mock_client_class.return_value.send.return_value = response

    send_email(
        api_key="sg.test-key",
        from_email="NSA Connect <noreply@semo.edu>",
        to_email="test@semo.edu",
        subject=WELCOME_EMAIL_SUBJECT,
        body="Hello",
    )

    mock_client_class.assert_called_once_with("sg.test-key")
    sent_message = mock_client_class.return_value.send.call_args[0][0]
    assert sent_message.from_email.email == "noreply@semo.edu"
    assert sent_message.personalizations[0].tos[0]["email"] == "test@semo.edu"
    assert sent_message.subject.subject == WELCOME_EMAIL_SUBJECT


@patch("app.integrations.sendgrid_client.SendGridAPIClient")
def test_sendgrid_client_raises_on_error_response(mock_client_class):
    from app.integrations.sendgrid_client import SendGridDeliveryError, send_email

    response = MagicMock(status_code=403, body="Forbidden")
    mock_client_class.return_value.send.return_value = response

    try:
        send_email(
            api_key="sg.test-key",
            from_email="NSA Connect <noreply@semo.edu>",
            to_email="test@semo.edu",
            subject=WELCOME_EMAIL_SUBJECT,
            body="Hello",
        )
        raised = False
    except SendGridDeliveryError:
        raised = True

    assert raised is True


def test_build_prep_task_due_soon_email_body_includes_task_details():
    due_date = datetime(2030, 5, 20, 12, 0, tzinfo=UTC)
    body = build_prep_task_due_soon_email_body(
        full_name="Board Member",
        event_title="Dashain Celebration",
        group_name="Food & Beverage",
        due_date=due_date,
    )

    assert "Hi Board Member," in body
    assert "Food & Beverage" in body
    assert "Dashain Celebration" in body
    assert "May 20, 2030" in body


def test_send_prep_task_due_soon_email_skips_when_disabled(caplog):
    due_date = datetime(2030, 5, 20, 12, 0, tzinfo=UTC)

    with caplog.at_level(logging.INFO):
        send_prep_task_due_soon_email(
            email="board@semo.edu",
            full_name="Board Member",
            event_title="Dashain Celebration",
            group_name="Food & Beverage",
            due_date=due_date,
        )

    assert "Prep task due-soon email (disabled)" in caplog.text
    assert "board@semo.edu" in caplog.text


def test_build_volunteer_task_assigned_email_body_includes_task_details():
    event_starts_at = datetime(2030, 6, 1, 18, 0, tzinfo=UTC)
    body = build_volunteer_task_assigned_email_body(
        full_name="Test User",
        task_name="Setup crew",
        event_title="Dashain Celebration",
        event_starts_at=event_starts_at,
    )

    assert "Hi Test User," in body
    assert "Setup crew" in body
    assert "Dashain Celebration" in body
    assert "June 01, 2030" in body


def test_send_volunteer_task_assigned_email_skips_when_disabled(caplog):
    event_starts_at = datetime(2030, 6, 1, 18, 0, tzinfo=UTC)

    with caplog.at_level(logging.INFO):
        send_volunteer_task_assigned_email(
            email="test@semo.edu",
            full_name="Test User",
            task_name="Setup crew",
            event_title="Dashain Celebration",
            event_starts_at=event_starts_at,
        )

    assert "Volunteer task assigned email (disabled)" in caplog.text
    assert "test@semo.edu" in caplog.text


def test_build_meeting_record_notification_email_body_includes_meeting_link():
    meeting_starts_at = datetime(2030, 5, 1, 18, 0, tzinfo=UTC)
    body = build_meeting_record_notification_email_body(
        full_name="Board Member",
        meeting_title="March Board Meeting",
        notification_kind="summary",
        recorded_by_name="Board Secretary",
        meeting_starts_at=meeting_starts_at,
        meeting_url="http://localhost:5173/events/meetings/3",
    )

    assert "Hi Board Member," in body
    assert "March Board Meeting" in body
    assert "Board Secretary" in body
    assert "http://localhost:5173/events/meetings/3" in body


def test_send_meeting_record_notification_email_skips_when_disabled(caplog):
    meeting_starts_at = datetime(2030, 5, 1, 18, 0, tzinfo=UTC)

    with caplog.at_level(logging.INFO):
        send_meeting_record_notification_email(
            email="board@semo.edu",
            full_name="Board Member",
            meeting_title="March Board Meeting",
            notification_kind="summary",
            recorded_by_name="Board Secretary",
            meeting_starts_at=meeting_starts_at,
            meeting_url="http://localhost:5173/events/meetings/3",
        )

    assert "Meeting record notification (disabled)" in caplog.text
    assert (
        MEETING_MINUTES_READY_SUBJECT.format(
            meeting_title="March Board Meeting",
        )
        in caplog.text
    )
