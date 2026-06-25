from app.integrations.sendgrid_client import send_email
from app.services.receipt_upload_service import upload_finance_receipt
from app.tasks.email_tasks import send_welcome_email_task


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
