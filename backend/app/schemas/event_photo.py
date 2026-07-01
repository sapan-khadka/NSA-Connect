from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.event import EventType
from app.models.event_photo import EventPhoto
from app.models.member import Member


class PhotoAlbumSummary(BaseModel):
    event_id: int
    event_name: str
    starts_at: datetime
    event_type: EventType
    photo_count: int
    cover_thumbnail_url: str | None = None


class PhotoAlbumListResponse(BaseModel):
    albums: list[PhotoAlbumSummary]
    total: int


class EventPhotoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    uploaded_by_id: int
    uploaded_by_name: str
    image_url: str
    thumbnail_url: str
    created_at: datetime
    can_delete: bool

    @classmethod
    def from_photo(
        cls,
        photo: EventPhoto,
        *,
        viewer: Member,
    ) -> "EventPhotoResponse":
        from app.services.event_photo_service import can_delete_event_photo

        uploader_name = photo.uploaded_by.full_name if photo.uploaded_by else "Unknown"
        return cls(
            id=photo.id,
            event_id=photo.event_id,
            uploaded_by_id=photo.uploaded_by_id,
            uploaded_by_name=uploader_name,
            image_url=photo.image_url,
            thumbnail_url=photo.thumbnail_url,
            created_at=photo.created_at,
            can_delete=can_delete_event_photo(viewer, photo),
        )


class EventPhotoListResponse(BaseModel):
    event_id: int
    event_name: str
    photos: list[EventPhotoResponse]
    total: int
