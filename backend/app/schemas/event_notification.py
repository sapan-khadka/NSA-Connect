from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ReminderStateLiteral = Literal[
    "sent",
    "scheduled",
    "due_soon",
    "none",
    "past",
]


class EventNotificationStatusResponse(BaseModel):
    event_id: int
    reminder_state: ReminderStateLiteral
    reminder_sent_count: int
    last_reminder_sent_at: datetime | None = None
    nudge_state: ReminderStateLiteral
    nudge_sent_count: int
    hours_until_start: float | None = None


class EventReminderSendResponse(BaseModel):
    candidates: int
    sent: int
    skipped: int
