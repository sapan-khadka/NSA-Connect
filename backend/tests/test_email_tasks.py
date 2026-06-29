from datetime import UTC, datetime
from unittest.mock import patch

from app.tasks.email_tasks import send_prep_task_due_soon_email_task


@patch("app.tasks.email_tasks.record_due_soon_reminder")
@patch("app.tasks.email_tasks.SessionLocal")
@patch("app.tasks.email_tasks.send_prep_task_due_soon_email")
def test_send_prep_task_due_soon_email_task_records_reminder_after_send(
    mock_send,
    mock_session_local,
    mock_record,
):
    due_date = datetime(2030, 5, 20, 12, 0, tzinfo=UTC)
    mock_send.return_value = True
    db = mock_session_local.return_value

    send_prep_task_due_soon_email_task(
        event_task_id=10,
        assignee_id=5,
        email="board@semo.edu",
        full_name="Board Member",
        event_title="Dashain Celebration",
        group_name="Food & Beverage",
        due_date_iso=due_date.isoformat(),
    )

    mock_send.assert_called_once_with(
        email="board@semo.edu",
        full_name="Board Member",
        event_title="Dashain Celebration",
        group_name="Food & Beverage",
        due_date=due_date,
    )
    mock_record.assert_called_once_with(
        db,
        event_task_id=10,
        assignee_id=5,
        recipient_email="board@semo.edu",
    )
    db.close.assert_called_once()


@patch("app.tasks.email_tasks.record_due_soon_reminder")
@patch("app.tasks.email_tasks.SessionLocal")
@patch("app.tasks.email_tasks.send_prep_task_due_soon_email")
def test_send_prep_task_due_soon_email_task_skips_record_when_send_fails(
    mock_send,
    mock_session_local,
    mock_record,
):
    mock_send.return_value = False

    send_prep_task_due_soon_email_task(
        event_task_id=10,
        assignee_id=5,
        email="board@semo.edu",
        full_name="Board Member",
        event_title="Dashain Celebration",
        group_name="Food & Beverage",
        due_date_iso=datetime(2030, 5, 20, 12, 0, tzinfo=UTC).isoformat(),
    )

    mock_session_local.assert_not_called()
    mock_record.assert_not_called()
