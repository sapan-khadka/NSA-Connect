import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
)

from app.integrations.sendgrid_client import send_email
from app.services.receipt_upload_service import upload_finance_receipt
from app.tasks.email_tasks import send_welcome_email_task


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_cloudinary_upload_is_mocked_during_tests(block_external_integrations):
    result = upload_finance_receipt(
        file_bytes=b"\xff\xd8\xffreceipt",
        content_type="image/jpeg",
    )

    block_external_integrations["cloudinary_upload_receipt"].assert_called_once()
    assert result.receipt_url.startswith("https://res.cloudinary.com/")


def test_celery_delay_never_executes_real_tasks(block_external_integrations):
    send_welcome_email_task.delay("test@semo.edu", "Test User")

    block_external_integrations["celery_delay"].assert_called_once_with(
        "test@semo.edu",
        "Test User",
    )
    block_external_integrations["celery_apply_async"].assert_not_called()


def test_sendgrid_client_is_mocked_during_tests(block_external_integrations):
    send_email(
        api_key="sg.test-key",
        from_email="NSA Connect <noreply@semo.edu>",
        to_email="test@semo.edu",
        subject="Test",
        body="Hello",
    )

    mock_client = block_external_integrations["sendgrid_client"]
    mock_client.assert_called_once_with("sg.test-key")
    mock_client.return_value.send.assert_called_once()


def test_anthropic_sdk_is_mocked_during_tests(block_external_integrations):
    block_external_integrations["anthropic_client"].assert_not_called()
    block_external_integrations[
        "anthropic_sdk_client"
    ].messages.create.assert_not_called()


def test_claude_checklist_endpoint_uses_mock_not_real_api(
    client,
    board_member_headers,
    mock_claude_checklist_api,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/ai/generate-checklist",
        json={
            "event_name": "Spring Social",
            "event_type": "social",
        },
        headers=board_member_headers,
    )

    assert response.status_code == 200
    mock_claude_checklist_api.messages.create.assert_called_once()
    block_external_integrations["anthropic_client"].assert_not_called()


def test_claude_announcement_endpoint_uses_mock_not_real_api(
    client,
    board_member_headers,
    mock_claude_announcement_api,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/ai/draft-announcement-email",
        json={"event_name": "Spring Social"},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    mock_claude_announcement_api.messages.create.assert_called_once()
    block_external_integrations["anthropic_client"].assert_not_called()


def test_claude_minutes_endpoint_uses_mock_not_real_api(
    client,
    board_member_headers,
    mock_claude_minutes_api,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/ai/summarize-minutes",
        json={"notes": "Discussed Dashain planning and room booking."},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    mock_claude_minutes_api.messages.create.assert_called_once()
    block_external_integrations["anthropic_client"].assert_not_called()
