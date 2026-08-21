from datetime import datetime

from pydantic import BaseModel, Field


class RunNotificationCheckRequest(BaseModel):
    as_of: datetime | None = Field(
        default=None,
        description="Optional UTC timestamp for testing time windows",
    )


class RunNotificationCheckResponse(BaseModel):
    checked_at: str
    event_reminders: dict[str, object]
    rsvp_nudges: dict[str, object]
    task_due_reminders: dict[str, object]
    dues_reminders: dict[str, object]
