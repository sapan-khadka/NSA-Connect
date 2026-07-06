import logging
import re
from collections.abc import Iterator
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session
from zipstream import ZIP_DEFLATED, ZipStream

from app.models.event import Event
from app.models.event_photo import EventPhoto
from app.models.member import Member
from app.services.event_photo_service import list_event_photos
from app.services.event_service import EventNotFoundError
from app.services.local_event_photo_storage import resolve_event_photo_fetch_url

logger = logging.getLogger(__name__)

PHOTO_FETCH_TIMEOUT_SECONDS = 30
PHOTO_DOWNLOAD_CHUNK_SIZE = 65536


class EventPhotoAlbumEmptyError(Exception):
    pass


@dataclass(frozen=True)
class SkippedPhoto:
    photo_id: int
    image_url: str
    reason: str


def build_album_zip_filename(event: Event) -> str:
    slug = _slugify(event.title)
    year = event.starts_at.year if event.starts_at else None
    if year is not None and not slug.endswith(str(year)):
        slug = f"{slug}-{year}"
    return f"{slug}-photos.zip"


def iter_event_photo_album_zip(
    db: Session,
    event_id: int,
    *,
    viewer: Member,
) -> tuple[Iterator[bytes], str]:
    event, photos = list_event_photos(db, event_id, viewer=viewer)
    if not photos:
        raise EventPhotoAlbumEmptyError("No photos to download")

    zip_filename = build_album_zip_filename(event)
    entries: list[tuple[str, str]] = []
    skipped: list[SkippedPhoto] = []

    with httpx.Client(
        timeout=PHOTO_FETCH_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:
        for index, photo in enumerate(photos, start=1):
            entry_name = _photo_entry_filename(photo, index)
            if _photo_url_available(client, resolve_event_photo_fetch_url(photo.image_url)):
                entries.append(
                    (
                        resolve_event_photo_fetch_url(photo.image_url),
                        entry_name,
                    )
                )
            else:
                skipped.append(
                    SkippedPhoto(
                        photo_id=photo.id,
                        image_url=photo.image_url,
                        reason="Could not fetch photo from storage",
                    )
                )

    if not entries:
        raise EventPhotoAlbumEmptyError(
            "All photos failed to download from storage"
        )

    skipped_manifest = (
        _format_skipped_manifest(skipped).encode("utf-8") if skipped else None
    )

    def generate() -> Iterator[bytes]:
        zip_stream = ZipStream(compress_type=ZIP_DEFLATED)
        with httpx.Client(
            timeout=PHOTO_FETCH_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as client:
            for url, entry_name in entries:
                zip_stream.add(
                    _iter_photo_bytes_with_client(client, url),
                    entry_name,
                )
            if skipped_manifest is not None:
                zip_stream.add(skipped_manifest, "_skipped_photos.txt")
            yield from zip_stream

    return generate(), zip_filename


def _photo_url_available(client: httpx.Client, url: str) -> bool:
    try:
        response = client.head(url)
        if response.status_code == 405:
            with client.stream(
                "GET",
                url,
                headers={"Range": "bytes=0-0"},
            ) as partial:
                partial.raise_for_status()
                return True
        response.raise_for_status()
        return True
    except httpx.HTTPError as exc:
        logger.warning("Photo HEAD check failed for %s: %s", url, exc)
        return False


def _iter_photo_bytes_with_client(
    client: httpx.Client,
    url: str,
) -> Iterator[bytes]:
    with client.stream("GET", url) as response:
        response.raise_for_status()
        yielded = False
        for chunk in response.iter_bytes(chunk_size=PHOTO_DOWNLOAD_CHUNK_SIZE):
            yielded = True
            yield chunk
        if not yielded:
            raise httpx.HTTPError("Photo response was empty")


def _format_skipped_manifest(skipped: list[SkippedPhoto]) -> str:
    lines = [
        "The following photos could not be included in this download:",
        "",
    ]
    for entry in skipped:
        lines.append(f"- Photo ID {entry.photo_id}: {entry.reason}")
        lines.append(f"  URL: {entry.image_url}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _photo_entry_filename(photo: EventPhoto, index: int) -> str:
    extension = _guess_extension(photo.image_url)
    return f"photo-{index:04d}.{extension}"


def _guess_extension(image_url: str) -> str:
    path = image_url.split("?", maxsplit=1)[0]
    filename = path.rsplit("/", maxsplit=1)[-1]
    if "." in filename:
        extension = filename.rsplit(".", maxsplit=1)[-1].lower()
        if extension.isalnum() and len(extension) <= 4:
            return extension
    return "jpg"


def _slugify(value: str) -> str:
    slug = value.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-") or "event"


__all__ = [
    "EventNotFoundError",
    "EventPhotoAlbumEmptyError",
    "build_album_zip_filename",
    "iter_event_photo_album_zip",
]
