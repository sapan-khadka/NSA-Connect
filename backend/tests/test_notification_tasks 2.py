from unittest.mock import patch

from app.celery_app import celery_app
from app.tasks.notification_tasks import run_scheduled_notification_checks_task


def test_celery_registers_notification_scan_task():
    assert (
        run_scheduled_notification_checks_task.name
        == "notifications.run_scheduled_checks"
    )
    assert "notifications.run_scheduled_checks" in celery_app.tasks


def test_celery_beat_schedules_notification_scan_every_30_minutes():
    schedule = celery_app.conf.beat_schedule["run-scheduled-notification-checks"]

    assert schedule["task"] == "notifications.run_scheduled_checks"
    assert str(schedule["schedule"]) == "<crontab: */30 * * * * (m/h/dM/MY/d)>"


@patch("app.tasks.notification_tasks.run_scheduled_notification_checks")
@patch("app.tasks.notification_tasks.SessionLocal")
def test_run_scheduled_notification_checks_task_runs_service(
    mock_session_local,
    mock_run,
):
    db = mock_session_local.return_value
    mock_run.return_value = {"event_reminders": {"sent": 0}}

    result = run_scheduled_notification_checks_task()

    mock_run.assert_called_once_with(db)
    db.close.assert_called_once()
    assert result == {"event_reminders": {"sent": 0}}
