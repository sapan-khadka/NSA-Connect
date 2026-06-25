from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery("nsa_connect")

celery_app.conf.update(
    broker_url=settings.REDIS_URL,
    result_backend=settings.REDIS_URL,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_default_queue="default",
    beat_schedule={
        "scan-prep-tasks-due-soon": {
            "task": "prep_tasks.scan_due_soon",
            "schedule": crontab(hour=9, minute=0),
        },
    },
)

celery_app.autodiscover_tasks(["app.tasks"])

# Ensure custom tasks are registered when the worker process loads the app.
import app.tasks.email_tasks  # noqa: E402, F401
import app.tasks.prep_task_tasks  # noqa: E402, F401
