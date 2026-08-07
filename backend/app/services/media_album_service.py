from datetime import UTC, datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryUploadError,
    delete_cloudinary_asset,
)
from app.models.media_album import MediaAlbum, MediaAlbumItem
from app.models.member import Member, MemberRole
from app.models.organization import Organization
from app.services.event_photo_service import list_photo_albums
from app.services.event_photo_upload_service import upload_event_photo_file
from app.services.local_event_photo_storage import (
    delete_local_event_photo,
    is_local_event_photo_public_id,
)
from app.services.organization_context import resolve_organization_id


class MediaAlbumNotFoundError(Exception):
    pass


class MediaAlbumPermissionError(Exception):
    pass


class MediaAlbumItemNotFoundError(Exception):
    pass


def _is_board_or_above(role: MemberRole) -> bool:
    return role in {MemberRole.BOARD, MemberRole.TREASURER, MemberRole.PRESIDENT}


def _org_id_for_member(db: Session, member: Member) -> int:
    return resolve_organization_id(db, member)


def can_manage_album(member: Member, album: MediaAlbum) -> bool:
    if _is_board_or_above(member.role):
        return True
    return album.created_by_id == member.id


def can_delete_item(member: Member, item: MediaAlbumItem) -> bool:
    if _is_board_or_above(member.role):
        return True
    return item.uploaded_by_id == member.id


def create_media_album(
    db: Session,
    *,
    viewer: Member,
    title: str,
    organization: Organization | None = None,
) -> MediaAlbum:
    org_id = (
        organization.id
        if organization is not None
        else _org_id_for_member(db, viewer)
    )
    cleaned = title.strip()
    if not cleaned:
        raise ValueError("Album title is required")

    now = datetime.now(UTC)
    album = MediaAlbum(
        organization_id=org_id,
        title=cleaned,
        created_by_id=viewer.id,
        created_at=now,
        updated_at=now,
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return album


def get_media_album(
    db: Session,
    album_id: int,
    *,
    viewer: Member,
) -> MediaAlbum:
    org_id = _org_id_for_member(db, viewer)
    album = db.scalar(
        select(MediaAlbum)
        .where(
            MediaAlbum.id == album_id,
            MediaAlbum.organization_id == org_id,
        )
        .options(
            selectinload(MediaAlbum.items).selectinload(MediaAlbumItem.uploaded_by)
        )
    )
    if album is None:
        raise MediaAlbumNotFoundError
    return album


def rename_media_album(
    db: Session,
    album_id: int,
    *,
    viewer: Member,
    title: str,
) -> MediaAlbum:
    album = get_media_album(db, album_id, viewer=viewer)
    if not can_manage_album(viewer, album):
        raise MediaAlbumPermissionError
    cleaned = title.strip()
    if not cleaned:
        raise ValueError("Album title is required")
    album.title = cleaned
    album.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(album)
    return album


def _delete_item_asset(item: MediaAlbumItem) -> None:
    if is_local_event_photo_public_id(item.public_id):
        delete_local_event_photo(item.public_id)
        return
    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        return
    try:
        delete_cloudinary_asset(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            public_id=item.public_id,
            resource_type=(
                "video" if (item.media_kind or "photo") == "video" else "image"
            ),
        )
    except CloudinaryUploadError:
        pass


def delete_media_album(
    db: Session,
    album_id: int,
    *,
    viewer: Member,
) -> None:
    album = get_media_album(db, album_id, viewer=viewer)
    if not can_manage_album(viewer, album):
        raise MediaAlbumPermissionError
    for item in list(album.items):
        _delete_item_asset(item)
    db.delete(album)
    db.commit()


def upload_media_album_item(
    db: Session,
    album_id: int,
    *,
    viewer: Member,
    file_bytes: bytes,
    content_type: str | None,
) -> MediaAlbumItem:
    album = get_media_album(db, album_id, viewer=viewer)
    upload_result = upload_event_photo_file(
        file_bytes=file_bytes,
        content_type=content_type,
    )
    item = MediaAlbumItem(
        album_id=album.id,
        uploaded_by_id=viewer.id,
        image_url=upload_result.image_url,
        thumbnail_url=upload_result.thumbnail_url,
        public_id=upload_result.public_id,
        media_kind=upload_result.media_kind or "photo",
        duration_seconds=upload_result.duration_seconds,
    )
    db.add(item)
    album.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    item = db.scalar(
        select(MediaAlbumItem)
        .where(MediaAlbumItem.id == item.id)
        .options(selectinload(MediaAlbumItem.uploaded_by))
    )
    return item


def delete_media_album_item(
    db: Session,
    album_id: int,
    item_id: int,
    *,
    viewer: Member,
) -> None:
    album = get_media_album(db, album_id, viewer=viewer)
    item = next((entry for entry in album.items if entry.id == item_id), None)
    if item is None:
        raise MediaAlbumItemNotFoundError
    if not can_delete_item(viewer, item):
        raise MediaAlbumPermissionError
    _delete_item_asset(item)
    db.delete(item)
    album.updated_at = datetime.now(UTC)
    db.commit()


def _custom_album_summaries(
    db: Session,
    *,
    viewer: Member,
) -> list[dict]:
    org_id = _org_id_for_member(db, viewer)
    albums = list(
        db.scalars(
            select(MediaAlbum)
            .where(MediaAlbum.organization_id == org_id)
            .order_by(MediaAlbum.updated_at.desc())
        ).all()
    )
    if not albums:
        return []

    album_ids = [album.id for album in albums]
    item_rows = db.execute(
        select(
            MediaAlbumItem.album_id,
            func.count(MediaAlbumItem.id).label("media_count"),
            func.sum(
                case((MediaAlbumItem.media_kind == "video", 1), else_=0)
            ).label("video_count"),
            func.min(MediaAlbumItem.id).label("cover_item_id"),
            func.max(MediaAlbumItem.created_at).label("latest_item_at"),
        )
        .where(MediaAlbumItem.album_id.in_(album_ids))
        .group_by(MediaAlbumItem.album_id)
    ).all()

    stats = {
        row.album_id: {
            "photo_count": int(row.media_count or 0) - int(row.video_count or 0),
            "video_count": int(row.video_count or 0),
            "cover_item_id": row.cover_item_id,
            "latest_item_at": row.latest_item_at,
        }
        for row in item_rows
    }
    cover_ids = [
        stats[album_id]["cover_item_id"]
        for album_id in stats
        if stats[album_id]["cover_item_id"]
    ]
    covers: dict[int, MediaAlbumItem] = {}
    if cover_ids:
        covers = {
            item.id: item
            for item in db.scalars(
                select(MediaAlbumItem).where(MediaAlbumItem.id.in_(cover_ids))
            ).all()
        }

    summaries: list[dict] = []
    for album in albums:
        album_stats = stats.get(album.id, {})
        cover_item = covers.get(album_stats.get("cover_item_id"))
        sort_at = album_stats.get("latest_item_at") or album.updated_at or album.created_at
        summaries.append(
            {
                "kind": "custom",
                "id": album.id,
                "title": album.title,
                "starts_at": None,
                "event_type": None,
                "photo_count": album_stats.get("photo_count", 0),
                "video_count": album_stats.get("video_count", 0),
                "cover_thumbnail_url": (
                    cover_item.thumbnail_url if cover_item else None
                ),
                "_sort_at": sort_at,
            }
        )
    return summaries


def list_unified_media_albums(
    db: Session,
    *,
    viewer: Member,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    event_albums, _ = list_photo_albums(
        db, viewer=viewer, limit=500, offset=0
    )
    mapped_events = [
        {
            "kind": "event",
            "id": album["event_id"],
            "title": album["event_name"],
            "starts_at": album["starts_at"],
            "event_type": (
                album["event_type"].value
                if hasattr(album["event_type"], "value")
                else str(album["event_type"])
            ),
            "photo_count": album["photo_count"],
            "video_count": album.get("video_count", 0),
            "cover_thumbnail_url": album.get("cover_thumbnail_url"),
            "_sort_at": album["starts_at"],
        }
        for album in event_albums
    ]
    custom_albums = _custom_album_summaries(db, viewer=viewer)
    merged = mapped_events + custom_albums
    merged.sort(
        key=lambda row: row.get("_sort_at") or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    total = len(merged)
    page = merged[offset : offset + limit]
    for row in page:
        row.pop("_sort_at", None)
    return page, total


def item_to_response_dict(item: MediaAlbumItem, *, viewer: Member) -> dict:
    uploader_name = item.uploaded_by.full_name if item.uploaded_by else "Unknown"
    return {
        "id": item.id,
        "album_id": item.album_id,
        "uploaded_by_id": item.uploaded_by_id,
        "uploaded_by_name": uploader_name,
        "image_url": item.image_url,
        "thumbnail_url": item.thumbnail_url,
        "created_at": item.created_at,
        "can_delete": can_delete_item(viewer, item),
        "media_kind": item.media_kind or "photo",
        "duration_seconds": item.duration_seconds,
    }
