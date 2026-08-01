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
    DiscussionReactionRequest,
    DiscussionReadReceiptRequest,
)
from app.services.discussion_room_service import DiscussionRoomNotFoundError
from app.services.discussion_service import (
    DiscussionForbiddenError,
    DiscussionMessageNotFoundError,
    DiscussionValidationError,
    apply_discussion_message_reaction,
    build_message_response,
    create_board_discussion_message,
    create_custom_room_discussion_message,
    create_event_discussion_message,
    edit_discussion_message,
    first_unread_message_id,
    get_thread_pin,
    get_viewer_last_read_message_id,
    list_board_discussion_messages,
    list_custom_room_discussion_messages,
    list_discussion_read_receipts,
    list_event_discussion_messages,
    messages_to_responses,
    pin_discussion_message,
    soft_delete_discussion_message,
    unpin_discussion_message,
    upsert_discussion_read_state,
)
from app.services.discussion_ws_rate_limit import (
    allow_ws_chat,
    allow_ws_reaction,
    allow_ws_typing,
)
from app.services.discussion_realtime_sync import touch_global_presence
from app.services.discussion_ws_manager import (
    BOARD_ROOM_KEY,
    PresenceUser,
    custom_room_key,
    discussion_connection_manager,
    event_room_key,
    new_fanout_id,
)
from app.services.event_service import EventNotFoundError
from app.services.user_notify_ws_manager import user_notify_connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["discussions-ws"])

WS_HISTORY_LIMIT = 50
WS_HISTORY_PAGE_MAX = 100
WS_CLOSE_UNAUTHORIZED = 4001
WS_CLOSE_FORBIDDEN = 4003


def _clamp_history_limit(limit: object | None) -> int:
    if not isinstance(limit, int) or isinstance(limit, bool):
        return WS_HISTORY_LIMIT
    return max(1, min(limit, WS_HISTORY_PAGE_MAX))


def _load_event_history(
    db: Session,
    *,
    event_id: int,
    member: Member,
    before_id: int | None = None,
    limit: int = WS_HISTORY_LIMIT,
):
    return list_event_discussion_messages(
        db,
        event_id=event_id,
        member=member,
        before_id=before_id,
        limit=limit,
    )


def _create_event_message(
    db: Session,
    *,
    event_id: int,
    member: Member,
    content: str,
    reply_to_message_id: int | None = None,
    attachments=None,
):
    return create_event_discussion_message(
        db,
        event_id=event_id,
        member=member,
        content=content,
        reply_to_message_id=reply_to_message_id,
        attachments=attachments,
    )


def _load_board_history(
    db: Session,
    *,
    member: Member,
    before_id: int | None = None,
    limit: int = WS_HISTORY_LIMIT,
):
    return list_board_discussion_messages(
        db,
        member=member,
        before_id=before_id,
        limit=limit,
    )


def _serialize_history_page(
    db: Session,
    *,
    messages,
    viewer_user_id: int,
) -> list[dict]:
    return [
        response.model_dump(mode="json")
        for response in messages_to_responses(
            db,
            messages,
            viewer_user_id=viewer_user_id,
        )
    ]


def _create_board_message(
    db: Session,
    *,
    member: Member,
    content: str,
    reply_to_message_id: int | None = None,
    attachments=None,
):
    return create_board_discussion_message(
        db,
        member=member,
        content=content,
        reply_to_message_id=reply_to_message_id,
        attachments=attachments,
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
    room_event_id: int | None,
    load_history: Callable,
    create_message: Callable,
    custom_room_id: int | None = None,
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
            history_payload = _serialize_history_page(
                db,
                messages=history,
                viewer_user_id=member.id,
            )
            viewer_last_read = get_viewer_last_read_message_id(
                db,
                room_id=room_key,
                user_id=member.id,
            )
            unread_id = first_unread_message_id(
                history,
                last_read_message_id=viewer_last_read,
            )
            read_receipts_payload = [
                receipt.model_dump(mode="json")
                for receipt in list_discussion_read_receipts(db, room_id=room_key)
            ]
            pinned = get_thread_pin(
                db, room_key=room_key, viewer_user_id=member.id
            )
            pinned_payload = (
                pinned.model_dump(mode="json") if pinned is not None else None
            )
        except (
            EventNotFoundError,
            DiscussionForbiddenError,
            DiscussionRoomNotFoundError,
        ):
            # Uniform close — do not leak whether a private room exists.
            await websocket.close(code=WS_CLOSE_FORBIDDEN)
            return

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
    touch_global_presence(member_id)
    try:
        history_event: dict = {
            "type": "history",
            "messages": history_payload,
            "pinned": pinned_payload,
        }
        if unread_id is not None:
            history_event["first_unread_message_id"] = unread_id
        await websocket.send_json(history_event)
        await websocket.send_json(
            {
                "type": "presence_snapshot",
                "users": snapshot,
            }
        )
        await websocket.send_json(
            {
                "type": "read_receipts_snapshot",
                "receipts": read_receipts_payload,
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
                touch_global_presence(member_id)
                continue

            if event_type == "load_history":
                before_id = body.get("before_id")
                if not isinstance(before_id, int) or isinstance(before_id, bool) or before_id < 1:
                    await websocket.send_json(
                        {"type": "error", "detail": "Invalid before_id"}
                    )
                    continue
                page_limit = _clamp_history_limit(body.get("limit"))
                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return
                    # Fetch one extra row to determine whether older pages remain.
                    page = load_history(
                        db,
                        member=author,
                        before_id=before_id,
                        limit=page_limit + 1,
                    )
                    has_more = len(page) > page_limit
                    if has_more:
                        page = page[:page_limit]
                    page_payload = _serialize_history_page(
                        db,
                        messages=page,
                        viewer_user_id=member_id,
                    )
                except (
                    EventNotFoundError,
                    DiscussionForbiddenError,
                    DiscussionRoomNotFoundError,
                ):
                    await websocket.close(code=WS_CLOSE_FORBIDDEN)
                    return
                except Exception:
                    logger.exception("Failed to load discussion history page")
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": "Failed to load older messages",
                        }
                    )
                    continue
                finally:
                    db.close()

                await websocket.send_json(
                    {
                        "type": "history_page",
                        "messages": page_payload,
                        "has_more": has_more,
                    }
                )
                continue

            if event_type == "typing":
                if not allow_ws_typing(member_id):
                    continue
                is_typing = bool(body.get("is_typing"))
                await _publish_typing(
                    room_key=room_key,
                    user=presence_user,
                    is_typing=is_typing,
                )
                continue

            if event_type == "read_receipt":
                try:
                    receipt_request = DiscussionReadReceiptRequest.model_validate(
                        body
                    )
                except ValidationError as exc:
                    detail = (
                        exc.errors()[0].get("msg", "Invalid read receipt")
                        if exc.errors()
                        else "Invalid read receipt"
                    )
                    await websocket.send_json(
                        {"type": "error", "detail": str(detail)}
                    )
                    continue

                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return

                    updated = upsert_discussion_read_state(
                        db,
                        member=author,
                        room_id=room_key,
                        last_read_message_id=receipt_request.last_read_message_id,
                        room_event_id=room_event_id,
                        custom_room_id=custom_room_id,
                    )
                except EventNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Event not found"}
                    )
                    continue
                except DiscussionForbiddenError:
                    await websocket.close(code=WS_CLOSE_FORBIDDEN)
                    return
                except DiscussionMessageNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except DiscussionValidationError as exc:
                    await websocket.send_json(
                        {"type": "error", "detail": str(exc)}
                    )
                    continue
                except Exception:
                    logger.exception("Failed to persist discussion read receipt")
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": "Failed to save read receipt",
                        }
                    )
                    continue
                finally:
                    db.close()

                if updated is not None:
                    await discussion_connection_manager.publish(
                        room_key,
                        {
                            "type": "read_receipt",
                            "fanout_id": new_fanout_id(),
                            "user_id": updated.user_id,
                            "room_id": updated.room_id,
                            "last_read_message_id": updated.last_read_message_id,
                            "full_name": updated.full_name,
                            "initials": updated.initials,
                        },
                    )
                continue

            if event_type == "reaction":
                if not allow_ws_reaction(member_id):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": "Too many reactions. Please slow down.",
                        }
                    )
                    continue
                try:
                    reaction = DiscussionReactionRequest.model_validate(body)
                except ValidationError as exc:
                    detail = (
                        exc.errors()[0].get("msg", "Invalid reaction")
                        if exc.errors()
                        else "Invalid reaction"
                    )
                    await websocket.send_json(
                        {"type": "error", "detail": str(detail)}
                    )
                    continue

                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return

                    changed = apply_discussion_message_reaction(
                        db,
                        member=author,
                        message_id=reaction.message_id,
                        emoji=reaction.emoji,
                        action=reaction.action,
                        room_event_id=room_event_id,
                        custom_room_id=custom_room_id,
                    )
                except EventNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Event not found"}
                    )
                    continue
                except DiscussionForbiddenError:
                    await websocket.close(code=WS_CLOSE_FORBIDDEN)
                    return
                except DiscussionMessageNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except DiscussionValidationError as exc:
                    await websocket.send_json(
                        {"type": "error", "detail": str(exc)}
                    )
                    continue
                except Exception:
                    logger.exception("Failed to persist discussion reaction")
                    await websocket.send_json(
                        {"type": "error", "detail": "Failed to save reaction"}
                    )
                    continue
                finally:
                    db.close()

                if changed:
                    await discussion_connection_manager.publish(
                        room_key,
                        {
                            "type": "reaction",
                            "fanout_id": new_fanout_id(),
                            "message_id": reaction.message_id,
                            "user_id": member_id,
                            "emoji": reaction.emoji.strip(),
                            "action": reaction.action,
                        },
                    )
                continue

            if event_type == "delete_message":
                message_id = body.get("message_id")
                if not isinstance(message_id, int) or message_id < 1:
                    await websocket.send_json(
                        {"type": "error", "detail": "Invalid message_id"}
                    )
                    continue
                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return
                    deleted = soft_delete_discussion_message(
                        db,
                        member=author,
                        message_id=message_id,
                    )
                    payload = build_message_response(deleted).model_dump(mode="json")
                except DiscussionMessageNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except DiscussionForbiddenError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except Exception:
                    logger.exception("Failed to delete discussion WS message")
                    await websocket.send_json(
                        {"type": "error", "detail": "Failed to delete message"}
                    )
                    continue
                finally:
                    db.close()
                await discussion_connection_manager.publish(
                    room_key,
                    {"type": "message_updated", "message": payload},
                )
                continue

            if event_type == "edit_message":
                if not allow_ws_chat(member_id):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": "Too many messages. Please slow down.",
                        }
                    )
                    continue
                try:
                    edit_req = DiscussionMessageCreateRequest.model_validate(
                        {"content": body.get("content")}
                    )
                except ValidationError as exc:
                    detail = (
                        exc.errors()[0].get("msg", "Invalid content")
                        if exc.errors()
                        else "Invalid content"
                    )
                    await websocket.send_json(
                        {"type": "error", "detail": str(detail)}
                    )
                    continue
                message_id = body.get("message_id")
                if not isinstance(message_id, int) or message_id < 1:
                    await websocket.send_json(
                        {"type": "error", "detail": "Invalid message_id"}
                    )
                    continue
                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return
                    edited = edit_discussion_message(
                        db,
                        member=author,
                        message_id=message_id,
                        content=edit_req.content,
                    )
                    payload = build_message_response(edited).model_dump(mode="json")
                except DiscussionMessageNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except DiscussionForbiddenError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except DiscussionValidationError as exc:
                    await websocket.send_json(
                        {"type": "error", "detail": str(exc)}
                    )
                    continue
                except Exception:
                    logger.exception("Failed to edit discussion WS message")
                    await websocket.send_json(
                        {"type": "error", "detail": "Failed to edit message"}
                    )
                    continue
                finally:
                    db.close()
                await discussion_connection_manager.publish(
                    room_key,
                    {"type": "message_updated", "message": payload},
                )
                continue

            if event_type == "pin_message":
                message_id = body.get("message_id")
                if not isinstance(message_id, int) or message_id < 1:
                    await websocket.send_json(
                        {"type": "error", "detail": "Invalid message_id"}
                    )
                    continue
                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return
                    pinned = pin_discussion_message(
                        db, member=author, message_id=message_id
                    )
                    payload = pinned.model_dump(mode="json")
                except DiscussionMessageNotFoundError:
                    await websocket.send_json(
                        {"type": "error", "detail": "Message not found"}
                    )
                    continue
                except DiscussionForbiddenError:
                    await websocket.close(code=WS_CLOSE_FORBIDDEN)
                    return
                except DiscussionValidationError as exc:
                    await websocket.send_json({"type": "error", "detail": str(exc)})
                    continue
                except Exception:
                    logger.exception("Failed to pin discussion message")
                    await websocket.send_json(
                        {"type": "error", "detail": "Failed to pin message"}
                    )
                    continue
                finally:
                    db.close()
                await discussion_connection_manager.publish(
                    room_key,
                    {"type": "pin_updated", "pinned": payload},
                )
                continue

            if event_type == "unpin_message":
                db = create_db_session()
                try:
                    author = db.get(Member, member_id)
                    if author is None or not author.can_authenticate():
                        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
                        return
                    unpin_discussion_message(
                        db, member=author, room_key=room_key
                    )
                except DiscussionForbiddenError:
                    await websocket.close(code=WS_CLOSE_FORBIDDEN)
                    return
                except Exception:
                    logger.exception("Failed to unpin discussion message")
                    await websocket.send_json(
                        {"type": "error", "detail": "Failed to unpin message"}
                    )
                    continue
                finally:
                    db.close()
                await discussion_connection_manager.publish(
                    room_key,
                    {"type": "pin_updated", "pinned": None},
                )
                continue

            # Chat message — either plain `{content}` or `{type:"chat", content}`.
            if not allow_ws_chat(member_id):
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Too many messages. Please slow down.",
                    }
                )
                continue
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
                    reply_to_message_id=parsed.reply_to_message_id,
                    attachments=parsed.attachments or None,
                )
                message_payload = build_message_response(created).model_dump(
                    mode="json"
                )
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
        room_event_id=event_id,
        load_history=lambda db, member, before_id=None, limit=WS_HISTORY_LIMIT: _load_event_history(
            db,
            event_id=event_id,
            member=member,
            before_id=before_id,
            limit=limit,
        ),
        create_message=lambda db, member, content, reply_to_message_id=None, attachments=None: _create_event_message(
            db,
            event_id=event_id,
            member=member,
            content=content,
            reply_to_message_id=reply_to_message_id,
            attachments=attachments,
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
        room_event_id=None,
        load_history=lambda db, member, before_id=None, limit=WS_HISTORY_LIMIT: _load_board_history(
            db,
            member=member,
            before_id=before_id,
            limit=limit,
        ),
        create_message=lambda db, member, content, reply_to_message_id=None, attachments=None: _create_board_message(
            db,
            member=member,
            content=content,
            reply_to_message_id=reply_to_message_id,
            attachments=attachments,
        ),
    )


@router.websocket("/ws/rooms/{room_id}/discussion")
async def custom_room_discussion_websocket(
    websocket: WebSocket,
    room_id: int,
    token: str | None = Query(default=None),
):
    await _discussion_websocket(
        websocket,
        token=token,
        room_key=custom_room_key(room_id),
        room_event_id=None,
        custom_room_id=room_id,
        load_history=lambda db, member, before_id=None, limit=WS_HISTORY_LIMIT: list_custom_room_discussion_messages(
            db,
            room_id=room_id,
            member=member,
            before_id=before_id,
            limit=limit,
        ),
        create_message=lambda db, member, content, reply_to_message_id=None, attachments=None: create_custom_room_discussion_message(
            db,
            room_id=room_id,
            member=member,
            content=content,
            reply_to_message_id=reply_to_message_id,
            attachments=attachments,
        ),
    )


@router.websocket("/ws/notifications")
async def user_notifications_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    """Realtime toast/push channel for inbox events (chat messages, etc.)."""
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
        member_id = member.id
    finally:
        db.close()

    await websocket.accept()
    await user_notify_connection_manager.connect(member_id, websocket)
    touch_global_presence(member_id)
    try:
        await websocket.send_json({"type": "ready"})
        while True:
            raw = await websocket.receive_text()
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(body, dict):
                continue
            if body.get("type") == "presence_heartbeat":
                touch_global_presence(member_id)
    except WebSocketDisconnect:
        pass
    finally:
        await user_notify_connection_manager.disconnect(member_id, websocket)
