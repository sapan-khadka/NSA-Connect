from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.prep_task_reminder_service import scan_and_notify_prep_tasks_due_soon


@celery_app.task(name="prep_tasks.scan_due_soon")
def scan_prep_tasks_due_soon_task() -> dict[str, int]:
    db = SessionLocal()
    try:
        return scan_and_notify_prep_tasks_due_soon(db)
    finally:
        db.close()
