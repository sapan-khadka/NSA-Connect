from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

AnnouncementCategoryLiteral = Literal["general", "urgent", "event_related"]
AnnouncementAudienceLiteral = Literal[
    "all_approved",
    "going",
    "maybe",
    "no_rsvp",
]


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
    audience: AnnouncementAudienceLiteral
    event_id: int | None = None
    author: AnnouncementAuthorResponse
    created_at: datetime
    updated_at: datetime


class AnnouncementListResponse(BaseModel):
    announcements: list[AnnouncementResponse]
    total: int


class AnnouncementRecipientPreviewResponse(BaseModel):
    audience: AnnouncementAudienceLiteral
    event_id: int | None = None
    total: int
    emailable: int


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    category: AnnouncementCategoryLiteral = "general"
    audience: AnnouncementAudienceLiteral = "all_approved"
    event_id: int | None = None

    @model_validator(mode="after")
    def audience_requires_event(self) -> "AnnouncementCreateRequest":
        if self.audience != "all_approved" and self.event_id is None:
            raise ValueError("event_id is required when audience is not all_approved")
        return self


class AnnouncementUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = Field(default=None, min_length=1)
    category: AnnouncementCategoryLiteral | None = None

    def has_updates(self) -> bool:
        return any(
            value is not None for value in (self.title, self.body, self.category)
        )
