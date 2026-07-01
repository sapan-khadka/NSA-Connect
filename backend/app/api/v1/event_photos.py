from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.models.member import Member
from app.schemas.event_photo import (
    EventPhotoListResponse,
    EventPhotoResponse,
    PhotoAlbumListResponse,
    PhotoAlbumSummary,
)
from app.services.event_photo_download_service import (
    EventPhotoAlbumEmptyError,
    iter_event_photo_album_zip,
)
from app.services.event_photo_service import (
    EventPhotoNotFoundError,
    EventPhotoPermissionError,
    delete_event_photo,
    list_event_photos,
    list_photo_albums,
    upload_and_create_event_photo,
)
from app.services.event_photo_upload_service import (
    EventPhotoUploadUnavailableError,
    EventPhotoValidationError,
)
from app.services.event_service import EventNotFoundError

router = APIRouter(tags=["event-photos"])


@router.get("/photos/albums", response_model=PhotoAlbumListResponse)
def list_photo_albums_endpoint(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    albums, total = list_photo_albums(db, limit=limit, offset=offset)
    return PhotoAlbumListResponse(
        albums=[PhotoAlbumSummary(**album) for album in albums],
        total=total,
    )


@router.get("/{event_id}/photos", response_model=EventPhotoListResponse)
def list_event_photos_endpoint(
    event_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        event, photos = list_event_photos(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventPhotoListResponse(
        event_id=event_id,
        event_name=event.title,
        photos=[
            EventPhotoResponse.from_photo(photo, viewer=current_member)
            for photo in photos
        ],
        total=len(photos),
    )


@router.post(
    "/{event_id}/photos",
    response_model=EventPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_event_photo_endpoint(
    event_id: int,
    file: UploadFile = File(...),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()

    try:
        photo = upload_and_create_event_photo(
            db,
            event_id=event_id,
            uploaded_by=current_member,
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventPhotoValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except EventPhotoUploadUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Photo upload is not configured",
        ) from exc

    return EventPhotoResponse.from_photo(photo, viewer=current_member)


@router.post("/{event_id}/photos/download")
def download_event_photo_album_endpoint(
    event_id: int,
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        zip_stream, zip_filename = iter_event_photo_album_zip(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except EventPhotoAlbumEmptyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc) or "No photos to download",
        ) from exc

    encoded_filename = quote(zip_filename)
    content_disposition = (
        f'attachment; filename="{zip_filename}"; '
        f"filename*=UTF-8''{encoded_filename}"
    )

    return StreamingResponse(
        zip_stream,
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition},
    )


@router.delete("/{event_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_photo_endpoint(
    event_id: int,
    photo_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        delete_event_photo(
            db,
            event_id=event_id,
            photo_id=photo_id,
            member=current_member,
        )
    except EventPhotoNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        ) from None
    except EventPhotoPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this photo",
        ) from None

    return None
