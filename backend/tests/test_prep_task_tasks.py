from unittest.mock import patch

from app.celery_app import celery_app
from app.tasks.prep_task_tasks import scan_prep_tasks_due_soon_task


def test_celery_registers_prep_task_due_soon_scan():
    assert scan_prep_tasks_due_soon_task.name == "prep_tasks.scan_due_soon"
    assert "prep_tasks.scan_due_soon" in celery_app.tasks


def test_celery_beat_schedules_daily_prep_task_scan():
    schedule = celery_app.conf.beat_schedule["scan-prep-tasks-due-soon"]

    assert schedule["task"] == "prep_tasks.scan_due_soon"
    assert str(schedule["schedule"]) == "<crontab: 0 9 * * * (m/h/dM/MY/d)>"


@patch("app.tasks.prep_task_tasks.scan_and_notify_prep_tasks_due_soon")
@patch("app.tasks.prep_task_tasks.SessionLocal")
def test_scan_prep_tasks_due_soon_task_runs_service(mock_session_local, mock_scan):
    db = mock_session_local.return_value
    mock_scan.return_value = {
        "scanned": 2,
        "emails_queued": 1,
        "skipped_unassigned": 0,
        "skipped_already_sent": 1,
    }

    result = scan_prep_tasks_due_soon_task()

    mock_scan.assert_called_once_with(db)
    db.close.assert_called_once()
    assert result == {
        "scanned": 2,
        "emails_queued": 1,
        "skipped_unassigned": 0,
        "skipped_already_sent": 1,
    }
