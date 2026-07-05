from datetime import datetime

from pydantic import BaseModel, Field


class RunNotificationCheckRequest(BaseModel):
    as_of: datetime | None = Field(
        default=None,
        description="Optional UTC timestamp for testing time windows",
    )
