from datetime import UTC, datetime
from unittest.mock import patch

from app.tasks.email_tasks import send_volunteer_task_assigned_email_task


@patch("app.tasks.email_tasks.send_volunteer_task_assigned_email")
def test_send_volunteer_task_assigned_email_task_sends_email(mock_send):
    event_starts_at = datetime(2030, 6, 1, 18, 0, tzinfo=UTC)

    send_volunteer_task_assigned_email_task(
        email="test@semo.edu",
        full_name="Test User",
        task_name="Setup crew",
        event_title="Dashain Celebration",
        event_starts_at_iso=event_starts_at.isoformat(),
    )

    mock_send.assert_called_once_with(
        email="test@semo.edu",
        full_name="Test User",
        task_name="Setup crew",
        event_title="Dashain Celebration",
        event_starts_at=event_starts_at,
    )
