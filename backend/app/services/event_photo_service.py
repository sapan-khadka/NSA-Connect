from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryEventPhotoResult,
    CloudinaryUploadError,
    delete_cloudinary_asset,
)
from app.models.event import Event
from app.models.event_photo import EventPhoto
from app.models.member import Member, MemberRole
from app.services.event_photo_upload_service import upload_event_photo_file
from app.services.event_service import EventNotFoundError
from app.services.local_event_photo_storage import (
    delete_local_event_photo,
    is_local_event_photo_public_id,
)


class EventPhotoNotFoundError(Exception):
    pass


class EventPhotoPermissionError(Exception):
    pass


def _is_board_or_above(role: MemberRole) -> bool:
    return role in {MemberRole.BOARD, MemberRole.TREASURER, MemberRole.PRESIDENT}


def can_delete_event_photo(member: Member, photo: EventPhoto) -> bool:
    if _is_board_or_above(member.role):
        return True
    return photo.uploaded_by_id == member.id


def list_photo_albums(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    events, total = _list_photo_archive_events(db, limit=limit, offset=offset)

    if not events:
        return [], total

    event_ids = [event.id for event in events]
    photo_rows = db.execute(
        select(
            EventPhoto.event_id,
            func.count(EventPhoto.id).label("photo_count"),
            func.min(EventPhoto.id).label("cover_photo_id"),
        )
        .where(EventPhoto.event_id.in_(event_ids))
        .group_by(EventPhoto.event_id)
    ).all()

    counts_by_event = {row.event_id: row.photo_count for row in photo_rows}
    cover_ids = [row.cover_photo_id for row in photo_rows if row.cover_photo_id]
    cover_photos = {}
    if cover_ids:
        covers = db.scalars(select(EventPhoto).where(EventPhoto.id.in_(cover_ids))).all()
        cover_photos = {photo.id: photo for photo in covers}

    cover_by_event: dict[int, str | None] = {}
    for row in photo_rows:
        cover_photo = cover_photos.get(row.cover_photo_id)
        cover_by_event[row.event_id] = (
            cover_photo.thumbnail_url if cover_photo else None
        )

    albums = [
        {
            "event_id": event.id,
            "event_name": event.title,
            "starts_at": event.starts_at,
            "event_type": event.event_type,
            "photo_count": counts_by_event.get(event.id, 0),
            "cover_thumbnail_url": cover_by_event.get(event.id),
        }
        for event in events
    ]
    return albums, total


def list_event_photos(db: Session, event_id: int) -> tuple[Event, list[EventPhoto]]:
    event = db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        raise EventNotFoundError

    photos = list(
        db.scalars(
            select(EventPhoto)
            .where(EventPhoto.event_id == event_id)
            .options(selectinload(EventPhoto.uploaded_by))
            .order_by(EventPhoto.created_at.asc())
        ).all()
    )
    return event, photos


def create_event_photo(
    db: Session,
    *,
    event_id: int,
    uploaded_by: Member,
    upload_result: CloudinaryEventPhotoResult,
) -> EventPhoto:
    event = db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        raise EventNotFoundError

    photo = EventPhoto(
        event_id=event_id,
        uploaded_by_id=uploaded_by.id,
        image_url=upload_result.image_url,
        thumbnail_url=upload_result.thumbnail_url,
        public_id=upload_result.public_id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    photo = db.scalar(
        select(EventPhoto)
        .where(EventPhoto.id == photo.id)
        .options(selectinload(EventPhoto.uploaded_by))
    )
    return photo


def upload_and_create_event_photo(
    db: Session,
    *,
    event_id: int,
    uploaded_by: Member,
    file_bytes: bytes,
    content_type: str | None,
) -> EventPhoto:
    upload_result = upload_event_photo_file(
        file_bytes=file_bytes,
        content_type=content_type,
    )
    return create_event_photo(
        db,
        event_id=event_id,
        uploaded_by=uploaded_by,
        upload_result=upload_result,
    )


def delete_event_photo(
    db: Session,
    *,
    event_id: int,
    photo_id: int,
    member: Member,
) -> None:
    photo = db.scalar(
        select(EventPhoto).where(
            EventPhoto.id == photo_id,
            EventPhoto.event_id == event_id,
        )
    )
    if photo is None:
        raise EventPhotoNotFoundError

    if not can_delete_event_photo(member, photo):
        raise EventPhotoPermissionError

    if is_local_event_photo_public_id(photo.public_id):
        delete_local_event_photo(photo.public_id)
    elif (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        try:
            delete_cloudinary_asset(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                public_id=photo.public_id,
            )
        except CloudinaryUploadError:
            pass

    db.delete(photo)
    db.commit()


def _list_photo_archive_events(
    db: Session,
    *,
    limit: int,
    offset: int,
) -> tuple[list[Event], int]:
    query = select(Event).where(Event.show_in_photo_archive.is_(True))
    count_query = (
        select(func.count())
        .select_from(Event)
        .where(Event.show_in_photo_archive.is_(True))
    )
    total = db.scalar(count_query) or 0
    events = db.scalars(
        query.order_by(Event.starts_at.desc()).offset(offset).limit(limit)
    ).all()
    return list(events), total
