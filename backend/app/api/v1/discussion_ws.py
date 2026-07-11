"""WebSocket live chat for event and board discussion threads."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import create_db_session
from app.core.ws_auth import (
    TokenAuthenticationError,
    TokenAuthorizationError,
    authenticate_member_from_token,
)
from app.models.member import Member
from app.schemas.discussion import (
    DiscussionMessageCreateRequest,
    DiscussionMessageResponse,
)
from app.services.discussion_service import (
    DiscussionForbiddenError,
    DiscussionValidationError,
    create_board_discussion_message,
    create_event_discussion_message,
    list_board_discussion_messages,
    list_event_discussion_messages,
)
from app.services.discussion_ws_manager import (
    BOARD_ROOM_KEY,
    PresenceUser,
    discussion_connection_manager,
    event_room_key,
    new_fanout_id,
)
from app.services.event_service import EventNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["discussions-ws"])

WS_HISTORY_LIMIT = 50
WS_CLOSE_UNAUTHORIZED = 4001
WS_CLOSE_FORBIDDEN = 4003


def _message_payload(message) -> dict:
    return DiscussionMessageResponse.model_validate(message).model_dump(mode="json")


def _load_event_history(db: Session, *, event_id: int, member: Member):
    return list_event_discussion_messages(
        db,
        event_id=event_id,
        member=member,
        limit=WS_HISTORY_LIMIT,
    )


def _create_event_message(
    db: Session, *, event_id: int, member: Member, content: str
):
    return create_event_discussion_message(
        db,
        event_id=event_id,
        member=member,
        content=content,
    )


def _load_board_history(db: Session, *, member: Member):
    return list_board_discussion_messages(
        db,
        member=member,
        limit=WS_HISTORY_LIMIT,
    )


def _create_board_message(db: Session, *, member: Member, content: str):
    return create_board_discussion_message(
        db,
        member=member,
        content=content,
    )


async def _publish_typing(
    *,
    room_key: str,
    user: PresenceUser,
    is_typing: bool,
) -> None:
    await discussion_connection_manager.publish(
        room_key,
        {
            "type": "typing",
            "fanout_id": new_fanout_id(),
            "is_typing": is_typing,
            "user": user.to_dict(),
        },
    )


async def _discussion_websocket(
    websocket: WebSocket,
    *,
    token: str | None,
    room_key: str,
    load_history: Callable,
    create_message: Callable,
):
    # Auth + history use a short-lived DB session so an open socket cannot
    # exhaust the SQLAlchemy connection pool and freeze the rest of the app.
    db = create_db_session()
    try:
        try:
            member = authenticate_member_from_token(db, token)
        except TokenAuthenticationError:
            await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
            return
        except TokenAuthorizationError:
            await websocket.close(code=WS_CLOSE_FORBIDDEN)
            return

        try:
            history = load_history(db, member=member)
        except EventNotFoundError:
            await websocket.close(code=WS_CLOSE_FORBIDDEN)
            return
        except DiscussionForbiddenError:
            await websocket.close(code=WS_CLOSE_FORBIDDEN)
            return

        history_payload = [_message_payload(message) for message in history]
        member_id = member.id
        presence_user = PresenceUser.from_member(member)
    finally:
        db.close()

    await websocket.accept()
    snapshot, is_first_for_user = await discussion_connection_manager.connect(
        room_key,
        websocket,
        user=presence_user,
    )
    try:
        await websocket.send_json(
            {
                "type": "history",
                "messages": history_payload,
            }
        )
        await websocket.send_json(
            {
                "type": "presence_snapshot",
                "users": snapshot,
            }
        )

        if is_first_for_user:
            await discussion_connection_manager.publish(
                room_key,
                {
                    "type": "presence",
                    "fanout_id": new_fanout_id(),
                    "action": "joined",
                    "user": presence_user.to_dict(),
                },
            )

        while True:
            raw = await websocket.receive_text()
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "detail": "Invalid JSON payload"}
                )
                continue

            if not isinstance(body, dict):
                await websocket.send_json(
                    {"type": "error", "detail": "Invalid message payload"}
                )
                continue

            event_type = body.get("type")
            if event_type == "presence_heartbeat":
                await discussion_connection_manager.refresh_presence(websocket)
                continue

            if event_type == "typing":
                is_typing = bool(body.get("is_typing"))
                await _publish_typing(
                    room_key=room_key,
                    user=presence_user,
                    is_typing=is_typing,
                )
                continue

            # Chat message — either plain `{content}` or `{type:"chat", content}`.
            try:
                parsed = DiscussionMessageCreateRequest.model_validate(body)
            except ValidationError as exc:
                detail = (
                    exc.errors()[0].get("msg", "Invalid content")
                    if exc.errors()
                    else "Invalid content"
                )
                await websocket.send_json({"type": "error", "detail": str(detail)})
                continue

            db = create_db_session()
            try:
                author = db.get(Member, member_id)
                if author is None or not author.can_authenticate():
                    await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                    return

                created = create_message(
                    db,
                    member=author,
                    content=parsed.content,
                )
                message_payload = _message_payload(created)
            except EventNotFoundError:
                await websocket.send_json(
                    {"type": "error", "detail": "Event not found"}
                )
                continue
            except DiscussionForbiddenError:
                await websocket.close(code=WS_CLOSE_FORBIDDEN)
                return
            except DiscussionValidationError as exc:
                await websocket.send_json({"type": "error", "detail": str(exc)})
                continue
            except Exception:
                logger.exception("Failed to persist discussion WS message")
                await websocket.send_json(
                    {"type": "error", "detail": "Failed to save message"}
                )
                continue
            finally:
                db.close()

            # Clear typing for the author when a real message is posted.
            await _publish_typing(
                room_key=room_key,
                user=presence_user,
                is_typing=False,
            )
            await discussion_connection_manager.publish(
                room_key,
                {"type": "message", "message": message_payload},
            )
    except WebSocketDisconnect:
        pass
    finally:
        left_user = await discussion_connection_manager.disconnect(
            room_key,
            websocket,
        )
        if left_user is not None:
            await discussion_connection_manager.publish(
                room_key,
                {
                    "type": "presence",
                    "fanout_id": new_fanout_id(),
                    "action": "left",
                    "user": left_user.to_dict(),
                },
            )
            await _publish_typing(
                room_key=room_key,
                user=left_user,
                is_typing=False,
            )


@router.websocket("/ws/events/{event_id}/discussion")
async def event_discussion_websocket(
    websocket: WebSocket,
    event_id: int,
    token: str | None = Query(default=None),
):
    await _discussion_websocket(
        websocket,
        token=token,
        room_key=event_room_key(event_id),
        load_history=lambda db, member: _load_event_history(
            db, event_id=event_id, member=member
        ),
        create_message=lambda db, member, content: _create_event_message(
            db, event_id=event_id, member=member, content=content
        ),
    )


@router.websocket("/ws/board/discussion")
async def board_discussion_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    await _discussion_websocket(
        websocket,
        token=token,
        room_key=BOARD_ROOM_KEY,
        load_history=lambda db, member: _load_board_history(db, member=member),
        create_message=lambda db, member, content: _create_board_message(
            db, member=member, content=content
        ),
    )
