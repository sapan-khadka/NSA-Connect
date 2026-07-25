from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import (
    get_current_member,
    require_board,
    require_task_oversight,
)
from app.core.rate_limit import limit
from app.models.member import Member
from app.core.security import create_ws_ticket
from app.schemas.discussion import (
    DiscussionArchiveResponse,
    DiscussionInboxResponse,
    DiscussionMessageCreateRequest,
    DiscussionMessageListResponse,
    DiscussionMessageResponse,
    DiscussionMessageUpdateRequest,
    DiscussionMuteToggleResponse,
    DiscussionPinToggleResponse,
    DiscussionPresenceResponse,
    DiscussionRoomIdRequest,
    DiscussionRoomReadResponse,
    DiscussionWsTicketResponse,
)
from app.schemas.discussion_room import (
    DirectMessageCreateRequest,
    DiscussionRoomCreateRequest,
    DiscussionRoomListResponse,
    DiscussionRoomRejectRequest,
    DiscussionRoomResponse,
)
from app.services.discussion_inbox_service import (
    archive_inbox_room,
    list_discussion_inbox,
    mark_discussion_room_read,
    toggle_discussion_room_mute,
    toggle_discussion_room_pin,
    unarchive_inbox_room,
)
from app.services.discussion_realtime_sync import users_online
from app.services.discussion_room_service import (
    DiscussionRoomInvalidStateError,
    DiscussionRoomNotFoundError,
    approve_discussion_room,
    archive_discussion_room,
    assert_can_access_custom_room,
    build_room_response,
    create_discussion_room,
    get_or_create_dm,
    list_my_discussion_rooms,
    list_pending_discussion_rooms,
    reject_discussion_room,
)
from app.services.discussion_service import (
    DEFAULT_DISCUSSION_LIMIT,
    DiscussionForbiddenError,
    DiscussionMessageNotFoundError,
    DiscussionValidationError,
    build_message_response,
    create_board_discussion_message,
    create_custom_room_discussion_message,
    create_event_discussion_message,
    edit_discussion_message,
    list_board_discussion_messages,
    list_custom_room_discussion_messages,
    list_event_discussion_messages,
    messages_to_responses,
    soft_delete_discussion_message,
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
    "/discussions/mutes/toggle",
    response_model=DiscussionMuteToggleResponse,
)
def toggle_discussion_room_mute_endpoint(
    data: DiscussionRoomIdRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        return toggle_discussion_room_mute(
            db,
            member=current_member,
            room_id=data.room_id,
        )
    except (EventNotFoundError, DiscussionForbiddenError, DiscussionValidationError) as exc:
        _handle_room_access_errors(exc)


@router.post(
    "/discussions/ws-ticket",
    response_model=DiscussionWsTicketResponse,
)
def create_discussion_ws_ticket_endpoint(
    current_member: Member = Depends(get_current_member),
):
    token, expires_at = create_ws_ticket(
        member_id=current_member.id,
        email=current_member.email,
        role=current_member.role.value
        if hasattr(current_member.role, "value")
        else str(current_member.role),
        token_version=current_member.token_version,
    )
    return DiscussionWsTicketResponse(token=token, expires_at=expires_at)


@router.get(
    "/discussions/presence",
    response_model=DiscussionPresenceResponse,
)
def get_discussion_presence_endpoint(
    user_ids: str = Query(
        default="",
        description="Comma-separated member ids to check (max 50)",
    ),
    current_member: Member = Depends(get_current_member),
):
    del current_member  # auth gate only
    raw_ids = [part.strip() for part in user_ids.split(",") if part.strip()]
    parsed: list[int] = []
    for raw in raw_ids[:50]:
        try:
            value = int(raw)
        except ValueError:
            continue
        if value > 0:
            parsed.append(value)
    online = users_online(parsed)
    return DiscussionPresenceResponse(
        online={str(user_id): bool(is_online) for user_id, is_online in online.items()}
    )


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
@limit(f"{settings.RATE_LIMIT_DISCUSSION_MESSAGE_MAX}/minute")
def create_event_discussion_endpoint(
    request: Request,
    event_id: int,
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    del request
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
@limit(f"{settings.RATE_LIMIT_DISCUSSION_MESSAGE_MAX}/minute")
def create_board_discussion_endpoint(
    request: Request,
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    del request
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
        # Uniform 404 avoids leaking whether a private DM room exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion room not found",
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
    return build_room_response(room, viewer_id=current_member.id)


@router.post(
    "/discussions/dms",
    response_model=DiscussionRoomResponse,
)
@limit(f"{settings.RATE_LIMIT_DISCUSSION_DM_MAX}/minute")
def ensure_direct_message_endpoint(
    request: Request,
    data: DirectMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    """Find or create a private 1:1 DM with another approved member."""
    del request  # required by SlowAPI limit decorator
    try:
        room = get_or_create_dm(
            db,
            actor=current_member,
            target_member_id=data.member_id,
        )
    except (DiscussionForbiddenError, DiscussionValidationError) as exc:
        _handle_room_admin_errors(exc)
    return build_room_response(room, viewer_id=current_member.id)


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
    return build_room_response(room, viewer_id=current_member.id)


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
@limit(f"{settings.RATE_LIMIT_DISCUSSION_MESSAGE_MAX}/minute")
def create_custom_room_message_endpoint(
    request: Request,
    room_id: int,
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    del request
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


@router.patch(
    "/discussions/messages/{message_id}",
    response_model=DiscussionMessageResponse,
)
@limit(f"{settings.RATE_LIMIT_DISCUSSION_MESSAGE_MAX}/minute")
def edit_discussion_message_endpoint(
    request: Request,
    message_id: int,
    data: DiscussionMessageUpdateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    del request
    try:
        message = edit_discussion_message(
            db,
            member=current_member,
            message_id=message_id,
            content=data.content,
        )
    except DiscussionMessageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        ) from None
    except DiscussionForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        ) from None
    except DiscussionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None
    return build_message_response(message)


@router.delete(
    "/discussions/messages/{message_id}",
    response_model=DiscussionMessageResponse,
)
@limit(f"{settings.RATE_LIMIT_DISCUSSION_MESSAGE_MAX}/minute")
def delete_discussion_message_endpoint(
    request: Request,
    message_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    del request
    try:
        message = soft_delete_discussion_message(
            db,
            member=current_member,
            message_id=message_id,
        )
    except DiscussionMessageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        ) from None
    except DiscussionForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        ) from None
    return build_message_response(message)
