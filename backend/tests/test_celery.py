from app.celery_app import celery_app
from app.tasks.email_tasks import (
    send_meeting_record_notification_email_task,
    send_prep_task_due_soon_email_task,
    send_volunteer_task_assigned_email_task,
    send_welcome_email_task,
)


def test_celery_uses_redis_broker():
    assert celery_app.conf.broker_url.startswith("redis://")
    assert celery_app.conf.result_backend.startswith("redis://")


def test_celery_registers_welcome_email_task():
    assert send_welcome_email_task.name == "email.send_welcome"
    assert "email.send_welcome" in celery_app.tasks


def test_celery_registers_prep_task_due_soon_email_task():
    assert send_prep_task_due_soon_email_task.name == "email.send_prep_task_due_soon"
    assert "email.send_prep_task_due_soon" in celery_app.tasks


def test_celery_registers_volunteer_task_assigned_email_task():
    assert (
        send_volunteer_task_assigned_email_task.name
        == "email.send_volunteer_task_assigned"
    )
    assert "email.send_volunteer_task_assigned" in celery_app.tasks


def test_celery_registers_meeting_record_notification_email_task():
    assert (
        send_meeting_record_notification_email_task.name
        == "email.send_meeting_record_notification"
    )
    assert "email.send_meeting_record_notification" in celery_app.tasks
