from datetime import datetime
from typing import Literal

from pydantic import BaseModel

EventActivityKindLiteral = Literal[
    "budget",
    "volunteer",
    "reminder",
    "photo",
    "schedule",
    "invite",
]


class EventActivityItemResponse(BaseModel):
    id: str
    kind: EventActivityKindLiteral
    title: str
    detail: str | None = None
    occurred_at: datetime


class EventActivityListResponse(BaseModel):
    items: list[EventActivityItemResponse]
    total: int
