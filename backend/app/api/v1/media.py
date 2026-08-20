from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, get_current_organization
from app.core.upload import read_upload_with_limit
from app.models.member import Member
from app.models.organization import Organization
from app.schemas.media_album import (
    MediaAlbumCreate,
    MediaAlbumDetailResponse,
    MediaAlbumItemResponse,
    MediaAlbumListResponse,
    MediaAlbumSummary,
    MediaAlbumUpdate,
)
from app.services.event_photo_upload_service import (
    EventPhotoUploadUnavailableError,
    EventPhotoValidationError,
)
from app.services.media_album_download_service import (
    MediaAlbumEmptyError,
    iter_media_album_zip,
)
from app.services.media_album_service import (
    MediaAlbumItemNotFoundError,
    MediaAlbumNotFoundError,
    MediaAlbumPermissionError,
    can_manage_album,
    create_media_album,
    delete_media_album,
    delete_media_album_item,
    get_media_album,
    item_to_response_dict,
    list_unified_media_albums,
    rename_media_album,
    upload_media_album_item,
)

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/albums", response_model=MediaAlbumListResponse)
def list_media_albums_endpoint(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    albums, total = list_unified_media_albums(
        db, viewer=current_member, limit=limit, offset=offset
    )
    return MediaAlbumListResponse(
        albums=[MediaAlbumSummary(**album) for album in albums],
        total=total,
    )


@router.post(
    "/albums",
    response_model=MediaAlbumSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_media_album_endpoint(
    body: MediaAlbumCreate,
    current_member: Member = Depends(get_current_member),
    organization: Organization = Depends(get_current_organization),
    db: Session = Depends(get_db),
):
    try:
        album = create_media_album(
            db,
            viewer=current_member,
            title=body.title,
            organization=organization,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    return MediaAlbumSummary(
        kind="custom",
        id=album.id,
        title=album.title,
        starts_at=None,
        event_type=None,
        photo_count=0,
        video_count=0,
        cover_thumbnail_url=None,
    )


@router.get("/albums/{album_id}", response_model=MediaAlbumDetailResponse)
def get_media_album_endpoint(
    album_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        album = get_media_album(db, album_id, viewer=current_member)
    except MediaAlbumNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        ) from None

    items = [
        MediaAlbumItemResponse(**item_to_response_dict(item, viewer=current_member))
        for item in album.items
    ]
    video_count = sum(1 for item in items if item.media_kind == "video")
    return MediaAlbumDetailResponse(
        id=album.id,
        title=album.title,
        created_by_id=album.created_by_id,
        created_at=album.created_at,
        updated_at=album.updated_at,
        can_manage=can_manage_album(current_member, album),
        items=items,
        total=len(items),
        photo_count=len(items) - video_count,
        video_count=video_count,
    )


@router.patch("/albums/{album_id}", response_model=MediaAlbumSummary)
def rename_media_album_endpoint(
    album_id: int,
    body: MediaAlbumUpdate,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        album = rename_media_album(
            db, album_id, viewer=current_member, title=body.title
        )
    except MediaAlbumNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        ) from None
    except MediaAlbumPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to rename this album",
        ) from None
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    return MediaAlbumSummary(
        kind="custom",
        id=album.id,
        title=album.title,
        starts_at=None,
        event_type=None,
        photo_count=0,
        video_count=0,
        cover_thumbnail_url=None,
    )


@router.delete("/albums/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media_album_endpoint(
    album_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        delete_media_album(db, album_id, viewer=current_member)
    except MediaAlbumNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        ) from None
    except MediaAlbumPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this album",
        ) from None
    return None


@router.post(
    "/albums/{album_id}/items",
    response_model=MediaAlbumItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_media_album_item_endpoint(
    album_id: int,
    file: UploadFile = File(...),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    file_bytes = await read_upload_with_limit(file, max_bytes=100 * 1024 * 1024)
    try:
        item = upload_media_album_item(
            db,
            album_id,
            viewer=current_member,
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
    except MediaAlbumNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        ) from None
    except EventPhotoValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except EventPhotoUploadUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Media upload is not configured",
        ) from exc

    return MediaAlbumItemResponse(
        **item_to_response_dict(item, viewer=current_member)
    )


@router.delete(
    "/albums/{album_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media_album_item_endpoint(
    album_id: int,
    item_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        delete_media_album_item(
            db, album_id, item_id, viewer=current_member
        )
    except MediaAlbumNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        ) from None
    except MediaAlbumItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media item not found",
        ) from None
    except MediaAlbumPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this item",
        ) from None
    return None


@router.post("/albums/{album_id}/download")
def download_media_album_endpoint(
    album_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        zip_stream, zip_filename = iter_media_album_zip(
            db, album_id, viewer=current_member
        )
    except MediaAlbumNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        ) from None
    except MediaAlbumEmptyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc) or "No media to download",
        ) from exc

    encoded_filename = quote(zip_filename)
    content_disposition = (
        f"attachment; filename=\"{zip_filename}\"; filename*=UTF-8''{encoded_filename}"
    )
    return StreamingResponse(
        zip_stream,
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition},
    )
