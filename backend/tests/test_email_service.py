import logging
from unittest.mock import MagicMock, patch

from app.services.email_service import (
    WELCOME_EMAIL_SUBJECT,
    build_welcome_email_body,
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
