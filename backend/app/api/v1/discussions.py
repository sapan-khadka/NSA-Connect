from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    get_current_member,
    require_board,
    require_task_oversight,
)
from app.models.member import Member
from app.schemas.discussion import (
    DiscussionArchiveResponse,
    DiscussionInboxResponse,
    DiscussionMessageCreateRequest,
    DiscussionMessageListResponse,
    DiscussionMessageResponse,
    DiscussionPinToggleResponse,
    DiscussionRoomIdRequest,
    DiscussionRoomReadResponse,
)
from app.schemas.discussion_room import (
    DiscussionRoomCreateRequest,
    DiscussionRoomListResponse,
    DiscussionRoomRejectRequest,
    DiscussionRoomResponse,
)
from app.services.discussion_inbox_service import (
    archive_inbox_room,
    list_discussion_inbox,
    mark_discussion_room_read,
    toggle_discussion_room_pin,
    unarchive_inbox_room,
)
from app.services.discussion_room_service import (
    DiscussionRoomInvalidStateError,
    DiscussionRoomNotFoundError,
    approve_discussion_room,
    archive_discussion_room,
    assert_can_access_custom_room,
    build_room_response,
    create_discussion_room,
    list_my_discussion_rooms,
    list_pending_discussion_rooms,
    reject_discussion_room,
)
from app.services.discussion_service import (
    DEFAULT_DISCUSSION_LIMIT,
    DiscussionForbiddenError,
    DiscussionValidationError,
    build_message_response,
    create_board_discussion_message,
    create_custom_room_discussion_message,
    create_event_discussion_message,
    list_board_discussion_messages,
    list_custom_room_discussion_messages,
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
    return list_discussion_inbox(db, member=current_member)


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


@router.post(
    "/discussions/archive",
    response_model=DiscussionArchiveResponse,
)
def archive_discussion_inbox_room_endpoint(
    data: DiscussionRoomIdRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_task_oversight),
):
    try:
        return archive_inbox_room(
            db,
            member=current_member,
            room_id=data.room_id,
        )
    except (
        EventNotFoundError,
        DiscussionForbiddenError,
        DiscussionValidationError,
        DiscussionRoomNotFoundError,
        DiscussionRoomInvalidStateError,
    ) as exc:
        if isinstance(exc, (DiscussionRoomNotFoundError, DiscussionRoomInvalidStateError)):
            _handle_room_admin_errors(exc)
        _handle_room_access_errors(exc)


@router.post(
    "/discussions/unarchive",
    response_model=DiscussionArchiveResponse,
)
def unarchive_discussion_inbox_room_endpoint(
    data: DiscussionRoomIdRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_task_oversight),
):
    try:
        return unarchive_inbox_room(
            db,
            member=current_member,
            room_id=data.room_id,
        )
    except (
        EventNotFoundError,
        DiscussionForbiddenError,
        DiscussionValidationError,
        DiscussionRoomNotFoundError,
        DiscussionRoomInvalidStateError,
    ) as exc:
        if isinstance(exc, (DiscussionRoomNotFoundError, DiscussionRoomInvalidStateError)):
            _handle_room_admin_errors(exc)
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


def _handle_room_admin_errors(exc: Exception) -> NoReturn:
    if isinstance(exc, DiscussionRoomNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion room not found",
        ) from None
    if isinstance(exc, DiscussionForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DISCUSSION_FORBIDDEN_DETAIL,
        ) from None
    if isinstance(exc, DiscussionRoomInvalidStateError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None
    if isinstance(exc, DiscussionValidationError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None
    raise exc


@router.post(
    "/discussions/rooms",
    response_model=DiscussionRoomResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_discussion_room_endpoint(
    data: DiscussionRoomCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    try:
        room = create_discussion_room(
            db,
            creator=current_member,
            name=data.name,
            description=data.description,
            member_ids=data.member_ids,
        )
    except (DiscussionForbiddenError, DiscussionValidationError) as exc:
        _handle_room_admin_errors(exc)
    return build_room_response(room)


@router.get(
    "/discussions/rooms/pending",
    response_model=DiscussionRoomListResponse,
)
def list_pending_discussion_rooms_endpoint(
    db: Session = Depends(get_db),
    _current_member: Member = Depends(require_task_oversight),
):
    rooms = list_pending_discussion_rooms(db)
    return DiscussionRoomListResponse(
        rooms=[build_room_response(room) for room in rooms],
        total=len(rooms),
    )


@router.get(
    "/discussions/rooms/mine",
    response_model=DiscussionRoomListResponse,
)
def list_my_discussion_rooms_endpoint(
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    rooms = list_my_discussion_rooms(db, member=current_member)
    return DiscussionRoomListResponse(
        rooms=[build_room_response(room) for room in rooms],
        total=len(rooms),
    )


@router.get(
    "/discussions/rooms/{room_id}",
    response_model=DiscussionRoomResponse,
)
def get_discussion_room_endpoint(
    room_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        room = assert_can_access_custom_room(
            db,
            room_id=room_id,
            member=current_member,
        )
    except (DiscussionRoomNotFoundError, DiscussionForbiddenError) as exc:
        _handle_room_admin_errors(exc)
    return build_room_response(room)


@router.post(
    "/discussions/rooms/{room_id}/approve",
    response_model=DiscussionRoomResponse,
)
def approve_discussion_room_endpoint(
    room_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_task_oversight),
):
    try:
        room = approve_discussion_room(
            db,
            room_id=room_id,
            reviewer=current_member,
        )
    except (
        DiscussionRoomNotFoundError,
        DiscussionForbiddenError,
        DiscussionRoomInvalidStateError,
    ) as exc:
        _handle_room_admin_errors(exc)
    return build_room_response(room)


@router.post(
    "/discussions/rooms/{room_id}/reject",
    response_model=DiscussionRoomResponse,
)
def reject_discussion_room_endpoint(
    room_id: int,
    data: DiscussionRoomRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_task_oversight),
):
    try:
        room = reject_discussion_room(
            db,
            room_id=room_id,
            reviewer=current_member,
            review_note=data.review_note if data else None,
        )
    except (
        DiscussionRoomNotFoundError,
        DiscussionForbiddenError,
        DiscussionRoomInvalidStateError,
    ) as exc:
        _handle_room_admin_errors(exc)
    return build_room_response(room)


@router.post(
    "/discussions/rooms/{room_id}/archive",
    response_model=DiscussionRoomResponse,
)
def archive_discussion_room_endpoint(
    room_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_task_oversight),
):
    try:
        room = archive_discussion_room(
            db,
            room_id=room_id,
            actor=current_member,
        )
    except (
        DiscussionRoomNotFoundError,
        DiscussionForbiddenError,
        DiscussionRoomInvalidStateError,
    ) as exc:
        _handle_room_admin_errors(exc)
    return build_room_response(room)


@router.get(
    "/discussions/rooms/{room_id}/messages",
    response_model=DiscussionMessageListResponse,
)
def list_custom_room_messages_endpoint(
    room_id: int,
    after_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=DEFAULT_DISCUSSION_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        messages = list_custom_room_discussion_messages(
            db,
            room_id=room_id,
            member=current_member,
            after_id=after_id,
            limit=limit,
        )
    except (DiscussionRoomNotFoundError, DiscussionForbiddenError) as exc:
        _handle_room_admin_errors(exc)

    return DiscussionMessageListResponse(
        messages=messages_to_responses(
            db,
            messages,
            viewer_user_id=current_member.id,
        ),
        total=len(messages),
    )


@router.post(
    "/discussions/rooms/{room_id}/messages",
    response_model=DiscussionMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_custom_room_message_endpoint(
    room_id: int,
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        message = create_custom_room_discussion_message(
            db,
            room_id=room_id,
            member=current_member,
            content=data.content,
        )
    except (
        DiscussionRoomNotFoundError,
        DiscussionForbiddenError,
        DiscussionValidationError,
    ) as exc:
        _handle_room_admin_errors(exc)

    return build_message_response(message)
