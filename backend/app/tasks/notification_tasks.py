from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.notification_scan_service import run_scheduled_notification_checks


@celery_app.task(name="notifications.run_scheduled_checks")
def run_scheduled_notification_checks_task() -> dict[str, object]:
    db = SessionLocal()
    try:
        return run_scheduled_notification_checks(db)
    finally:
        db.close()
