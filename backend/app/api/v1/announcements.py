from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.announcement import (
    AnnouncementAudienceLiteral,
    AnnouncementAuthorResponse,
    AnnouncementCreateRequest,
    AnnouncementListResponse,
    AnnouncementRecipientPreviewResponse,
    AnnouncementResponse,
    AnnouncementUpdateRequest,
)
from app.services.announcement_recipients import count_emailable_recipients
from app.services.announcement_service import (
    AnnouncementEventInvalidError,
    AnnouncementNotFoundError,
    create_announcement,
    delete_announcement,
    get_announcement,
    list_announcements,
    update_announcement,
)

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _to_response(announcement) -> AnnouncementResponse:
    return AnnouncementResponse(
        id=announcement.id,
        title=announcement.title,
        body=announcement.body,
        category=announcement.category.value,
        audience=announcement.audience,
        event_id=announcement.event_id,
        author=AnnouncementAuthorResponse.model_validate(announcement.author),
        created_at=announcement.created_at,
        updated_at=announcement.updated_at,
    )


@router.get("", response_model=AnnouncementListResponse)
def list_announcements_endpoint(
    event_id: int | None = Query(default=None),
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    rows = list_announcements(db, event_id=event_id)
    return AnnouncementListResponse(
        announcements=[_to_response(row) for row in rows],
        total=len(rows),
    )


@router.get(
    "/recipient-preview",
    response_model=AnnouncementRecipientPreviewResponse,
)
def recipient_preview_endpoint(
    audience: AnnouncementAudienceLiteral = Query(default="all_approved"),
    event_id: int | None = Query(default=None),
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    if audience != "all_approved" and event_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="event_id is required when audience is not all_approved",
        )
    counts = count_emailable_recipients(
        db,
        audience=audience,
        event_id=event_id,
    )
    return AnnouncementRecipientPreviewResponse(
        audience=audience,
        event_id=event_id,
        total=counts["total"],
        emailable=counts["emailable"],
    )


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement_endpoint(
    announcement_id: int,
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        announcement = get_announcement(db, announcement_id)
    except AnnouncementNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        ) from None

    return _to_response(announcement)


@router.post(
    "",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement_endpoint(
    data: AnnouncementCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        announcement = create_announcement(db, author=current_member, data=data)
    except AnnouncementEventInvalidError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    return _to_response(announcement)


@router.patch("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement_endpoint(
    announcement_id: int,
    data: AnnouncementUpdateRequest,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    if not data.has_updates():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided",
        )

    try:
        announcement = update_announcement(
            db,
            announcement_id=announcement_id,
            data=data,
        )
    except AnnouncementNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        ) from None

    return _to_response(announcement)


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement_endpoint(
    announcement_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        delete_announcement(db, announcement_id=announcement_id)
    except AnnouncementNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        ) from None
