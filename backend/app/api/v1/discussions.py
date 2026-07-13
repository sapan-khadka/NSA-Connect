from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.discussion import (
    DiscussionInboxResponse,
    DiscussionMessageCreateRequest,
    DiscussionMessageListResponse,
    DiscussionMessageResponse,
    DiscussionPinToggleResponse,
    DiscussionRoomIdRequest,
    DiscussionRoomReadResponse,
)
from app.services.discussion_inbox_service import (
    list_discussion_inbox,
    mark_discussion_room_read,
    toggle_discussion_room_pin,
)
from app.services.discussion_service import (
    DEFAULT_DISCUSSION_LIMIT,
    DiscussionForbiddenError,
    DiscussionValidationError,
    build_message_response,
    create_board_discussion_message,
    create_event_discussion_message,
    list_board_discussion_messages,
    list_event_discussion_messages,
    messages_to_responses,
)
from app.services.event_service import EventNotFoundError

router = APIRouter(tags=["discussions"])

DISCUSSION_FORBIDDEN_DETAIL = "You do not have access to this discussion"


def _handle_room_access_errors(exc: Exception) -> NoReturn:
    if isinstance(exc, EventNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    if isinstance(exc, DiscussionForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DISCUSSION_FORBIDDEN_DETAIL,
        ) from None
    if isinstance(exc, DiscussionValidationError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None
    raise exc


@router.get(
    "/discussions/inbox",
    response_model=DiscussionInboxResponse,
)
def list_discussion_inbox_endpoint(
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    rooms = list_discussion_inbox(db, member=current_member)
    return DiscussionInboxResponse(rooms=rooms)


@router.post(
    "/discussions/read",
    response_model=DiscussionRoomReadResponse,
)
def mark_discussion_room_read_endpoint(
    data: DiscussionRoomIdRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        return mark_discussion_room_read(
            db,
            member=current_member,
            room_id=data.room_id,
        )
    except (EventNotFoundError, DiscussionForbiddenError, DiscussionValidationError) as exc:
        _handle_room_access_errors(exc)


@router.post(
    "/discussions/pins/toggle",
    response_model=DiscussionPinToggleResponse,
)
def toggle_discussion_room_pin_endpoint(
    data: DiscussionRoomIdRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        return toggle_discussion_room_pin(
            db,
            member=current_member,
            room_id=data.room_id,
        )
    except (EventNotFoundError, DiscussionForbiddenError, DiscussionValidationError) as exc:
        _handle_room_access_errors(exc)


@router.get(
    "/events/{event_id}/discussion",
    response_model=DiscussionMessageListResponse,
)
def list_event_discussion_endpoint(
    event_id: int,
    after_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=DEFAULT_DISCUSSION_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        messages = list_event_discussion_messages(
            db,
            event_id=event_id,
            member=current_member,
            after_id=after_id,
            limit=limit,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except DiscussionForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DISCUSSION_FORBIDDEN_DETAIL,
        ) from None

    return DiscussionMessageListResponse(
        messages=messages_to_responses(
            db,
            messages,
            viewer_user_id=current_member.id,
        ),
        total=len(messages),
    )


@router.post(
    "/events/{event_id}/discussion",
    response_model=DiscussionMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_discussion_endpoint(
    event_id: int,
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        message = create_event_discussion_message(
            db,
            event_id=event_id,
            member=current_member,
            content=data.content,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except DiscussionForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DISCUSSION_FORBIDDEN_DETAIL,
        ) from None
    except DiscussionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None

    return build_message_response(message)


@router.get(
    "/board/discussion",
    response_model=DiscussionMessageListResponse,
)
def list_board_discussion_endpoint(
    after_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=DEFAULT_DISCUSSION_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    messages = list_board_discussion_messages(
        db,
        member=current_member,
        after_id=after_id,
        limit=limit,
    )
    return DiscussionMessageListResponse(
        messages=messages_to_responses(
            db,
            messages,
            viewer_user_id=current_member.id,
        ),
        total=len(messages),
    )


@router.post(
    "/board/discussion",
    response_model=DiscussionMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_board_discussion_endpoint(
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    try:
        message = create_board_discussion_message(
            db,
            member=current_member,
            content=data.content,
        )
    except DiscussionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None

    return build_message_response(message)
