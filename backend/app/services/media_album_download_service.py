import logging
import re
from collections.abc import Iterator
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session
from zipstream import ZIP_DEFLATED, ZipStream

from app.models.media_album import MediaAlbum, MediaAlbumItem
from app.models.member import Member
from app.services.local_event_photo_storage import resolve_event_photo_fetch_url
from app.services.media_album_service import (
    MediaAlbumNotFoundError,
    get_media_album,
)

logger = logging.getLogger(__name__)

PHOTO_FETCH_TIMEOUT_SECONDS = 30
PHOTO_DOWNLOAD_CHUNK_SIZE = 65536


class MediaAlbumEmptyError(Exception):
    pass


@dataclass(frozen=True)
class SkippedItem:
    item_id: int
    image_url: str
    reason: str


def build_media_album_zip_filename(album: MediaAlbum) -> str:
    slug = _slugify(album.title)
    return f"{slug}-media.zip"


def iter_media_album_zip(
    db: Session,
    album_id: int,
    *,
    viewer: Member,
) -> tuple[Iterator[bytes], str]:
    album = get_media_album(db, album_id, viewer=viewer)
    items = list(album.items)
    if not items:
        raise MediaAlbumEmptyError("No media to download")

    zip_filename = build_media_album_zip_filename(album)
    entries: list[tuple[str, str]] = []
    skipped: list[SkippedItem] = []

    with httpx.Client(
        timeout=PHOTO_FETCH_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:
        for index, item in enumerate(items, start=1):
            entry_name = _item_entry_filename(item, index)
            url = resolve_event_photo_fetch_url(item.image_url)
            if _url_available(client, url):
                entries.append((url, entry_name))
            else:
                skipped.append(
                    SkippedItem(
                        item_id=item.id,
                        image_url=item.image_url,
                        reason="Could not fetch media from storage",
                    )
                )

    if not entries:
        raise MediaAlbumEmptyError("All media failed to download from storage")

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
                    _iter_bytes_with_client(client, url),
                    entry_name,
                )
            if skipped_manifest is not None:
                zip_stream.add(skipped_manifest, "_skipped_media.txt")
            yield from zip_stream

    return generate(), zip_filename


def _url_available(client: httpx.Client, url: str) -> bool:
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
        logger.warning("Media HEAD check failed for %s: %s", url, exc)
        return False


def _iter_bytes_with_client(
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
            raise httpx.HTTPError("Media response was empty")


def _format_skipped_manifest(skipped: list[SkippedItem]) -> str:
    lines = [
        "The following media could not be included in this download:",
        "",
    ]
    for entry in skipped:
        lines.append(f"- Item ID {entry.item_id}: {entry.reason}")
        lines.append(f"  URL: {entry.image_url}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _item_entry_filename(item: MediaAlbumItem, index: int) -> str:
    extension = _guess_extension(item.image_url)
    prefix = "video" if (item.media_kind or "photo") == "video" else "photo"
    return f"{prefix}-{index:04d}.{extension}"


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
    return slug.strip("-") or "album"
