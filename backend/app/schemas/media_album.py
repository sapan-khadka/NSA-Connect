from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MediaAlbumSummary(BaseModel):
    kind: Literal["event", "custom"]
    id: int
    title: str
    starts_at: datetime | None = None
    event_type: str | None = None
    photo_count: int = 0
    video_count: int = 0
    cover_thumbnail_url: str | None = None


class MediaAlbumListResponse(BaseModel):
    albums: list[MediaAlbumSummary]
    total: int


class MediaAlbumCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class MediaAlbumUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class MediaAlbumItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    album_id: int
    uploaded_by_id: int
    uploaded_by_name: str
    image_url: str
    thumbnail_url: str
    created_at: datetime
    can_delete: bool
    media_kind: str = "photo"
    duration_seconds: int | None = None


class MediaAlbumDetailResponse(BaseModel):
    id: int
    title: str
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    can_manage: bool
    items: list[MediaAlbumItemResponse]
    total: int
    photo_count: int = 0
    video_count: int = 0
