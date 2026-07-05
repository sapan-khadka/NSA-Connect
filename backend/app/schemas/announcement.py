from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AnnouncementCategoryLiteral = Literal["general", "urgent", "event_related"]


class AnnouncementAuthorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    category: AnnouncementCategoryLiteral
    author: AnnouncementAuthorResponse
    created_at: datetime
    updated_at: datetime


class AnnouncementListResponse(BaseModel):
    announcements: list[AnnouncementResponse]
    total: int


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    category: AnnouncementCategoryLiteral = "general"


class AnnouncementUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = Field(default=None, min_length=1)
    category: AnnouncementCategoryLiteral | None = None

    def has_updates(self) -> bool:
        return any(
            value is not None
            for value in (self.title, self.body, self.category)
        )
