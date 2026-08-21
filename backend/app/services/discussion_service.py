from collections import defaultdict
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import member_has_role_at_least
from app.lib.event_visibility import event_visible_to_member
from app.models.discussion_message import (
    MAX_DISCUSSION_CONTENT_LENGTH,
    DiscussionMessage,
)
from app.models.discussion_message_attachment import DiscussionMessageAttachment
from app.models.discussion_message_reaction import DiscussionMessageReaction
from app.models.discussion_read_state import DiscussionReadState
from app.models.discussion_thread_pin import DiscussionThreadPin
from app.models.event import Event
from app.models.member import Member, MemberRole
from app.schemas.discussion import (
    DiscussionAttachmentPayload,
    DiscussionAttachmentResponse,
    DiscussionMessageAuthor,
    DiscussionMessageResponse,
    DiscussionPinnedMessageResponse,
    DiscussionReactionSummary,
    DiscussionReadReceiptResponse,
    DiscussionReplyPreview,
    DiscussionSharedFileListResponse,
    DiscussionSharedFileResponse,
)
from app.services.discussion_attachment_upload_service import (
    MAX_ATTACHMENTS_PER_MESSAGE,
    is_allowed_attachment_url,
)
from app.services.discussion_ws_manager import (
    BOARD_ROOM_KEY,
    custom_room_key,
    event_room_key,
    initials_from_name,
)
from app.services.event_service import EventNotFoundError
from app.services.event_volunteer_signup_service import get_member_volunteer_signup

DEFAULT_DISCUSSION_LIMIT = 100
MAX_DISCUSSION_LIMIT = 200

ALLOWED_DISCUSSION_REACTION_EMOJIS = frozenset({"👍", "❤️", "😂", "🎉", "😮"})
ReactionAction = Literal["add", "remove"]


class DiscussionForbiddenError(Exception):
    pass


class DiscussionValidationError(Exception):
    pass


class DiscussionMessageNotFoundError(Exception):
    pass


def discussion_room_id_for_event(event_id: int) -> str:
    return event_room_key(event_id)


def discussion_room_id_for_board() -> str:
    return BOARD_ROOM_KEY


def discussion_room_id_for_custom_room(room_id: int) -> str:
    return custom_room_key(room_id)


DELETED_MESSAGE_PLACEHOLDER = "This message was deleted"
MESSAGE_EDIT_WINDOW_SECONDS = 15 * 60


def _normalize_content(content: str, *, allow_empty: bool = False) -> str:
    # Drop C0 controls (keep tab/newline) and DEL; reject empty after strip.
    cleaned = "".join(
        ch for ch in content if ch in "\t\n\r" or (ord(ch) >= 32 and ch != "\x7f")
    ).strip()
    if not cleaned:
        if allow_empty:
            return ""
        raise DiscussionValidationError("Message content is required")
    if len(cleaned) > MAX_DISCUSSION_CONTENT_LENGTH:
        raise DiscussionValidationError(
            f"Message must be at most {MAX_DISCUSSION_CONTENT_LENGTH} characters"
        )
    return cleaned


def _message_load_options():
    reply_opts = joinedload(DiscussionMessage.reply_to).joinedload(
        DiscussionMessage.author
    )
    return (
        joinedload(DiscussionMessage.author),
        reply_opts,
        joinedload(DiscussionMessage.attachments),
    )


def _validate_and_build_attachments(
    payloads: list[DiscussionAttachmentPayload] | None,
) -> list[DiscussionMessageAttachment]:
    if not payloads:
        return []
    if len(payloads) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise DiscussionValidationError(
            f"At most {MAX_ATTACHMENTS_PER_MESSAGE} attachments per message"
        )
    rows: list[DiscussionMessageAttachment] = []
    for payload in payloads:
        if not is_allowed_attachment_url(payload.url):
            raise DiscussionValidationError("Attachment URL is not allowed")
        rows.append(
            DiscussionMessageAttachment(
                kind=payload.kind,
                file_name=payload.file_name[:512],
                content_type=payload.content_type[:128],
                size_bytes=payload.size_bytes,
                url=payload.url[:2048],
                public_id=(payload.public_id[:512] if payload.public_id else None),
                width=payload.width,
                height=payload.height,
                duration_ms=payload.duration_ms,
            )
        )
    return rows


def _maybe_mirror_attachments_to_event_album(
    db: Session,
    *,
    message: DiscussionMessage,
    author: Member,
    attachments: list[DiscussionMessageAttachment],
) -> None:
    """Best-effort: push image/video chat media into the event photo album."""
    if message.event_id is None or not attachments:
        return
    try:
        from app.integrations.cloudinary_client import CloudinaryEventPhotoResult
        from app.services.event_photo_service import create_event_photo
    except Exception:
        return

    for attachment in attachments:
        if attachment.kind not in {"image", "video"}:
            continue
        if not attachment.public_id:
            continue
        media_kind = "video" if attachment.kind == "video" else "photo"
        duration_seconds = None
        if attachment.duration_ms is not None:
            duration_seconds = max(0, int(round(attachment.duration_ms / 1000)))
        try:
            create_event_photo(
                db,
                event_id=message.event_id,
                uploaded_by=author,
                upload_result=CloudinaryEventPhotoResult(
                    image_url=attachment.url,
                    thumbnail_url=attachment.url,
                    public_id=attachment.public_id,
                    bytes=attachment.size_bytes,
                    format=None,
                    media_kind=media_kind,
                    duration_seconds=duration_seconds,
                ),
            )
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "Failed to mirror discussion attachment %s into event album",
                attachment.public_id,
            )


def member_can_access_event_discussion(
    db: Session,
    event: Event,
    member: Member,
) -> bool:
    if not event_visible_to_member(event, member):
        return False
    if member_has_role_at_least(member, MemberRole.BOARD):
        return True
    signup = get_member_volunteer_signup(
        db,
        event_id=event.id,
        member_id=member.id,
    )
    if signup is None:
        return False
    from app.models.event_volunteer_signup import EventVolunteerSignupStatus

    return signup.status != EventVolunteerSignupStatus.REJECTED


def assert_can_access_event_discussion(
    db: Session,
    *,
    event_id: int,
    member: Member,
) -> Event:
    event = db.get(Event, event_id)
    if event is None or not event_visible_to_member(event, member):
        raise EventNotFoundError
    if not member_can_access_event_discussion(db, event, member):
        raise DiscussionForbiddenError
    return event


def assert_can_access_board_discussion(member: Member) -> None:
    if not member_has_role_at_least(member, MemberRole.BOARD):
        raise DiscussionForbiddenError


def list_event_discussion_messages(
    db: Session,
    *,
    event_id: int,
    member: Member,
    after_id: int | None = None,
    before_id: int | None = None,
    limit: int = DEFAULT_DISCUSSION_LIMIT,
) -> list[DiscussionMessage]:
    assert_can_access_event_discussion(db, event_id=event_id, member=member)
    return _list_messages(
        db,
        event_id=event_id,
        custom_room_id=None,
        after_id=after_id,
        before_id=before_id,
        limit=limit,
    )


def list_board_discussion_messages(
    db: Session,
    *,
    member: Member,
    after_id: int | None = None,
    before_id: int | None = None,
    limit: int = DEFAULT_DISCUSSION_LIMIT,
) -> list[DiscussionMessage]:
    assert_can_access_board_discussion(member)
    return _list_messages(
        db,
        event_id=None,
        custom_room_id=None,
        after_id=after_id,
        before_id=before_id,
        limit=limit,
    )


def list_custom_room_discussion_messages(
    db: Session,
    *,
    room_id: int,
    member: Member,
    after_id: int | None = None,
    before_id: int | None = None,
    limit: int = DEFAULT_DISCUSSION_LIMIT,
) -> list[DiscussionMessage]:
    from app.services.discussion_room_service import assert_can_access_custom_room

    assert_can_access_custom_room(
        db,
        room_id=room_id,
        member=member,
        for_messaging=True,
    )
    return _list_messages(
        db,
        event_id=None,
        custom_room_id=room_id,
        after_id=after_id,
        before_id=before_id,
        limit=limit,
    )


def _list_messages(
    db: Session,
    *,
    event_id: int | None,
    custom_room_id: int | None,
    after_id: int | None,
    before_id: int | None = None,
    limit: int,
) -> list[DiscussionMessage]:
    capped_limit = max(1, min(limit, MAX_DISCUSSION_LIMIT))
    if custom_room_id is not None:
        scope_filter = and_(
            DiscussionMessage.custom_room_id == custom_room_id,
            DiscussionMessage.event_id.is_(None),
        )
    elif event_id is None:
        scope_filter = and_(
            DiscussionMessage.event_id.is_(None),
            DiscussionMessage.custom_room_id.is_(None),
        )
    else:
        scope_filter = and_(
            DiscussionMessage.event_id == event_id,
            DiscussionMessage.custom_room_id.is_(None),
        )

    load_opts = _message_load_options()

    if after_id is not None:
        statement = (
            select(DiscussionMessage)
            .options(*load_opts)
            .where(scope_filter, DiscussionMessage.id > after_id)
            .order_by(DiscussionMessage.id.asc())
            .limit(capped_limit)
        )
        return list(db.scalars(statement).unique().all())

    if before_id is not None:
        statement = (
            select(DiscussionMessage)
            .options(*load_opts)
            .where(scope_filter, DiscussionMessage.id < before_id)
            .order_by(DiscussionMessage.id.desc())
            .limit(capped_limit)
        )
        messages = list(db.scalars(statement).unique().all())
        messages.reverse()
        return messages

    statement = (
        select(DiscussionMessage)
        .options(*load_opts)
        .where(scope_filter)
        .order_by(DiscussionMessage.id.desc())
        .limit(capped_limit)
    )
    messages = list(db.scalars(statement).unique().all())
    messages.reverse()
    return messages


def create_event_discussion_message(
    db: Session,
    *,
    event_id: int,
    member: Member,
    content: str,
    reply_to_message_id: int | None = None,
    attachments: list[DiscussionAttachmentPayload] | None = None,
) -> DiscussionMessage:
    from app.services.discussion_inbox_service import assert_system_room_not_archived
    from app.services.discussion_ws_manager import event_room_key

    assert_can_access_event_discussion(db, event_id=event_id, member=member)
    assert_system_room_not_archived(db, event_room_key(event_id))
    return _create_message(
        db,
        author=member,
        content=content,
        event_id=event_id,
        custom_room_id=None,
        reply_to_message_id=reply_to_message_id,
        attachments=attachments,
        room_key=event_room_key(event_id),
    )


def create_board_discussion_message(
    db: Session,
    *,
    member: Member,
    content: str,
    reply_to_message_id: int | None = None,
    attachments: list[DiscussionAttachmentPayload] | None = None,
) -> DiscussionMessage:
    from app.services.discussion_inbox_service import assert_system_room_not_archived
    from app.services.discussion_ws_manager import BOARD_ROOM_KEY

    assert_can_access_board_discussion(member)
    assert_system_room_not_archived(db, BOARD_ROOM_KEY)
    return _create_message(
        db,
        author=member,
        content=content,
        event_id=None,
        custom_room_id=None,
        reply_to_message_id=reply_to_message_id,
        attachments=attachments,
        room_key=BOARD_ROOM_KEY,
    )


def create_custom_room_discussion_message(
    db: Session,
    *,
    room_id: int,
    member: Member,
    content: str,
    reply_to_message_id: int | None = None,
    attachments: list[DiscussionAttachmentPayload] | None = None,
) -> DiscussionMessage:
    from app.services.discussion_room_service import assert_can_access_custom_room

    assert_can_access_custom_room(
        db,
        room_id=room_id,
        member=member,
        for_messaging=True,
    )
    return _create_message(
        db,
        author=member,
        content=content,
        event_id=None,
        custom_room_id=room_id,
        reply_to_message_id=reply_to_message_id,
        attachments=attachments,
        room_key=custom_room_key(room_id),
    )


def _resolve_reply_target(
    db: Session,
    *,
    reply_to_message_id: int | None,
    event_id: int | None,
    custom_room_id: int | None,
) -> int | None:
    if reply_to_message_id is None:
        return None
    parent = db.get(DiscussionMessage, reply_to_message_id)
    if parent is None:
        raise DiscussionValidationError("Reply target not found")
    same_scope = (
        parent.event_id == event_id and parent.custom_room_id == custom_room_id
    )
    if not same_scope:
        raise DiscussionValidationError("Reply must target a message in this chat")
    return parent.id


def _create_message(
    db: Session,
    *,
    author: Member,
    content: str,
    event_id: int | None,
    custom_room_id: int | None,
    reply_to_message_id: int | None = None,
    attachments: list[DiscussionAttachmentPayload] | None = None,
    room_key: str | None = None,
) -> DiscussionMessage:
    resolved_reply = _resolve_reply_target(
        db,
        reply_to_message_id=reply_to_message_id,
        event_id=event_id,
        custom_room_id=custom_room_id,
    )
    attachment_rows = _validate_and_build_attachments(attachments)
    message = DiscussionMessage(
        content=_normalize_content(content, allow_empty=bool(attachment_rows)),
        author_id=author.id,
        event_id=event_id,
        custom_room_id=custom_room_id,
        reply_to_message_id=resolved_reply,
    )
    db.add(message)
    db.flush()
    for row in attachment_rows:
        row.message_id = message.id
        db.add(row)
    db.commit()
    message = db.scalars(
        select(DiscussionMessage)
        .options(*_message_load_options())
        .where(DiscussionMessage.id == message.id)
    ).unique().one()
    _maybe_mirror_attachments_to_event_album(
        db,
        message=message,
        author=author,
        attachments=list(message.attachments or []),
    )
    # create_event_photo commits; re-load so response relationships stay usable.
    message = db.scalars(
        select(DiscussionMessage)
        .options(*_message_load_options())
        .where(DiscussionMessage.id == message.id)
    ).unique().one()
    try:
        from app.services.discussion_message_notify_service import (
            notify_new_discussion_message,
        )

        notify_new_discussion_message(db, message=message, author=author)
    except Exception:
        import logging

        logging.getLogger(__name__).exception(
            "Failed to create discussion message notifications for message %s",
            message.id,
        )
    _ = room_key  # reserved for future room-scoped side effects
    return message


def _reply_preview(message: DiscussionMessage) -> DiscussionReplyPreview | None:
    parent = message.reply_to
    if parent is None and message.reply_to_message_id is None:
        return None
    if parent is None:
        return DiscussionReplyPreview(
            id=message.reply_to_message_id or 0,
            author_name="Member",
            content="Original message unavailable",
            is_deleted=True,
        )
    is_deleted = parent.deleted_at is not None
    author_name = (
        (parent.author.full_name if parent.author else None) or "Member"
    ).strip() or "Member"
    return DiscussionReplyPreview(
        id=parent.id,
        author_name=author_name,
        content="" if is_deleted else (parent.content or "")[:180],
        is_deleted=is_deleted,
    )


def build_message_response(
    message: DiscussionMessage,
    *,
    reactions: dict[str, DiscussionReactionSummary] | None = None,
) -> DiscussionMessageResponse:
    is_deleted = message.deleted_at is not None
    attachments: list[DiscussionAttachmentResponse] = []
    if not is_deleted:
        for row in message.attachments or []:
            attachments.append(DiscussionAttachmentResponse.model_validate(row))
    return DiscussionMessageResponse(
        id=message.id,
        content=DELETED_MESSAGE_PLACEHOLDER if is_deleted else message.content,
        event_id=message.event_id,
        custom_room_id=message.custom_room_id,
        created_at=message.created_at,
        edited_at=None if is_deleted else message.edited_at,
        deleted_at=message.deleted_at,
        is_deleted=is_deleted,
        author=DiscussionMessageAuthor.model_validate(message.author),
        reactions={} if is_deleted else (reactions or {}),
        reply_to_message_id=message.reply_to_message_id,
        reply_to=None if is_deleted else _reply_preview(message),
        attachments=attachments,
    )


def aggregate_message_reactions(
    db: Session,
    *,
    message_ids: list[int],
    viewer_user_id: int,
) -> dict[int, dict[str, DiscussionReactionSummary]]:
    if not message_ids:
        return {}

    rows = db.scalars(
        select(DiscussionMessageReaction).where(
            DiscussionMessageReaction.message_id.in_(message_ids)
        )
    ).all()

    counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    mine: dict[int, set[str]] = defaultdict(set)

    for row in rows:
        counts[row.message_id][row.emoji] += 1
        if row.user_id == viewer_user_id:
            mine[row.message_id].add(row.emoji)

    result: dict[int, dict[str, DiscussionReactionSummary]] = {}
    for message_id, emoji_counts in counts.items():
        result[message_id] = {
            emoji: DiscussionReactionSummary(
                count=count,
                reacted_by_me=emoji in mine[message_id],
            )
            for emoji, count in sorted(emoji_counts.items())
        }
    return result


def messages_to_responses(
    db: Session,
    messages: list[DiscussionMessage],
    *,
    viewer_user_id: int,
) -> list[DiscussionMessageResponse]:
    aggregates = aggregate_message_reactions(
        db,
        message_ids=[message.id for message in messages],
        viewer_user_id=viewer_user_id,
    )
    return [
        build_message_response(
            message,
            reactions=aggregates.get(message.id, {}),
        )
        for message in messages
    ]


def apply_discussion_message_reaction(
    db: Session,
    *,
    member: Member,
    message_id: int,
    emoji: str,
    action: ReactionAction,
    room_event_id: int | None,
    custom_room_id: int | None = None,
) -> bool:
    """Persist a reaction add/remove. Returns True if the DB row changed."""
    cleaned = emoji.strip()
    if cleaned not in ALLOWED_DISCUSSION_REACTION_EMOJIS:
        raise DiscussionValidationError("Unsupported reaction emoji")

    if custom_room_id is not None:
        from app.services.discussion_room_service import assert_can_access_custom_room

        assert_can_access_custom_room(
            db,
            room_id=custom_room_id,
            member=member,
            for_messaging=True,
        )
    elif room_event_id is None:
        assert_can_access_board_discussion(member)
    else:
        assert_can_access_event_discussion(
            db,
            event_id=room_event_id,
            member=member,
        )

    message = db.get(DiscussionMessage, message_id)
    if message is None:
        raise DiscussionMessageNotFoundError

    _assert_message_in_room(
        message,
        room_event_id=room_event_id,
        custom_room_id=custom_room_id,
    )

    existing = db.scalars(
        select(DiscussionMessageReaction).where(
            DiscussionMessageReaction.message_id == message_id,
            DiscussionMessageReaction.user_id == member.id,
            DiscussionMessageReaction.emoji == cleaned,
        )
    ).first()

    if action == "add":
        if existing is not None:
            return False
        db.add(
            DiscussionMessageReaction(
                message_id=message_id,
                user_id=member.id,
                emoji=cleaned,
            )
        )
        db.commit()
        return True

    if existing is None:
        return False
    db.delete(existing)
    db.commit()
    return True


def _assert_message_in_room(
    message: DiscussionMessage,
    *,
    room_event_id: int | None,
    custom_room_id: int | None = None,
) -> None:
    if custom_room_id is not None:
        if message.custom_room_id != custom_room_id or message.event_id is not None:
            raise DiscussionMessageNotFoundError
        return
    if room_event_id is None:
        if message.event_id is not None or message.custom_room_id is not None:
            raise DiscussionMessageNotFoundError
    elif message.event_id != room_event_id or message.custom_room_id is not None:
        raise DiscussionMessageNotFoundError


def _read_receipt_response(
    state: DiscussionReadState,
    member: Member,
) -> DiscussionReadReceiptResponse:
    full_name = (member.full_name or "").strip() or "Member"
    return DiscussionReadReceiptResponse(
        user_id=state.user_id,
        room_id=state.room_id,
        last_read_message_id=state.last_read_message_id,
        full_name=full_name,
        initials=initials_from_name(full_name),
    )


def list_discussion_read_receipts(
    db: Session,
    *,
    room_id: str,
) -> list[DiscussionReadReceiptResponse]:
    rows = db.scalars(
        select(DiscussionReadState)
        .options(joinedload(DiscussionReadState.user))
        .where(DiscussionReadState.room_id == room_id)
    ).unique().all()
    return [_read_receipt_response(row, row.user) for row in rows if row.user]


def get_viewer_last_read_message_id(
    db: Session,
    *,
    room_id: str,
    user_id: int,
) -> int | None:
    state = db.scalar(
        select(DiscussionReadState).where(
            DiscussionReadState.user_id == user_id,
            DiscussionReadState.room_id == room_id,
        )
    )
    if state is None:
        return None
    return int(state.last_read_message_id)


def first_unread_message_id(
    messages: list[DiscussionMessage],
    *,
    last_read_message_id: int | None,
) -> int | None:
    """Return the first message id after the viewer's read watermark."""
    if last_read_message_id is None or not messages:
        return None
    for message in messages:
        if message.id > last_read_message_id:
            return int(message.id)
    return None


def upsert_discussion_read_state(
    db: Session,
    *,
    member: Member,
    room_id: str,
    last_read_message_id: int,
    room_event_id: int | None,
    custom_room_id: int | None = None,
) -> DiscussionReadReceiptResponse | None:
    """Advance the user's read watermark. Returns None if unchanged/backwards."""
    if custom_room_id is not None:
        from app.services.discussion_room_service import assert_can_access_custom_room

        assert_can_access_custom_room(
            db,
            room_id=custom_room_id,
            member=member,
            for_messaging=True,
        )
        if room_id != custom_room_key(custom_room_id):
            raise DiscussionValidationError("Invalid room")
    elif room_event_id is None:
        assert_can_access_board_discussion(member)
        if room_id != BOARD_ROOM_KEY:
            raise DiscussionValidationError("Invalid room")
    else:
        assert_can_access_event_discussion(
            db,
            event_id=room_event_id,
            member=member,
        )
        if room_id != event_room_key(room_event_id):
            raise DiscussionValidationError("Invalid room")

    message = db.get(DiscussionMessage, last_read_message_id)
    if message is None:
        raise DiscussionMessageNotFoundError
    _assert_message_in_room(
        message,
        room_event_id=room_event_id,
        custom_room_id=custom_room_id,
    )

    existing = db.scalars(
        select(DiscussionReadState).where(
            DiscussionReadState.user_id == member.id,
            DiscussionReadState.room_id == room_id,
        )
    ).first()

    if existing is not None and existing.last_read_message_id >= last_read_message_id:
        return None

    if existing is None:
        existing = DiscussionReadState(
            user_id=member.id,
            room_id=room_id,
            last_read_message_id=last_read_message_id,
            updated_at=datetime.now(UTC),
        )
        db.add(existing)
    else:
        existing.last_read_message_id = last_read_message_id
        existing.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(existing)

    # Keep inbox unread watermark in sync with live read receipts.
    from app.services.discussion_inbox_service import sync_inbox_read_watermark

    sync_inbox_read_watermark(
        db,
        member=member,
        room_id=room_id,
        last_read_message_id=last_read_message_id,
        last_read_at=message.created_at,
    )

    return _read_receipt_response(existing, member)


def _load_message_for_author_mutation(
    db: Session,
    *,
    member: Member,
    message_id: int,
) -> DiscussionMessage:
    message = db.scalars(
        select(DiscussionMessage)
        .options(*_message_load_options())
        .where(DiscussionMessage.id == message_id)
    ).unique().first()
    if message is None:
        raise DiscussionMessageNotFoundError
    if message.author_id != member.id:
        raise DiscussionForbiddenError

    if message.custom_room_id is not None:
        from app.services.discussion_room_service import assert_can_access_custom_room

        assert_can_access_custom_room(
            db,
            room_id=message.custom_room_id,
            member=member,
            for_messaging=True,
        )
    elif message.event_id is not None:
        assert_can_access_event_discussion(
            db,
            event_id=message.event_id,
            member=member,
        )
    else:
        assert_can_access_board_discussion(member)

    return message


def soft_delete_discussion_message(
    db: Session,
    *,
    member: Member,
    message_id: int,
) -> DiscussionMessage:
    message = _load_message_for_author_mutation(
        db,
        member=member,
        message_id=message_id,
    )
    if message.deleted_at is not None:
        return message
    message.deleted_at = datetime.now(UTC)
    message.edited_at = None
    # Scrub body so deleted private content is not retained in the row.
    message.content = ""
    db.commit()
    db.refresh(message)
    _ = message.author
    return message


def edit_discussion_message(
    db: Session,
    *,
    member: Member,
    message_id: int,
    content: str,
) -> DiscussionMessage:
    message = _load_message_for_author_mutation(
        db,
        member=member,
        message_id=message_id,
    )
    if message.deleted_at is not None:
        raise DiscussionValidationError("Deleted messages cannot be edited")

    age = datetime.now(UTC) - message.created_at.astimezone(UTC)
    if age.total_seconds() > MESSAGE_EDIT_WINDOW_SECONDS:
        raise DiscussionValidationError(
            "Messages can only be edited within 15 minutes"
        )

    message.content = _normalize_content(content)
    message.edited_at = datetime.now(UTC)
    db.commit()
    db.refresh(message)
    _ = message.author
    return message


def room_key_for_message(message: DiscussionMessage) -> str:
    if message.custom_room_id is not None:
        return custom_room_key(message.custom_room_id)
    if message.event_id is not None:
        return event_room_key(message.event_id)
    return BOARD_ROOM_KEY


def get_thread_pin(
    db: Session,
    *,
    room_key: str,
    viewer_user_id: int,
) -> DiscussionPinnedMessageResponse | None:
    pin = db.scalars(
        select(DiscussionThreadPin)
        .options(
            joinedload(DiscussionThreadPin.message).joinedload(
                DiscussionMessage.author
            ),
            joinedload(DiscussionThreadPin.message)
            .joinedload(DiscussionMessage.reply_to)
            .joinedload(DiscussionMessage.author),
            joinedload(DiscussionThreadPin.message).joinedload(
                DiscussionMessage.attachments
            ),
            joinedload(DiscussionThreadPin.pinned_by),
        )
        .where(DiscussionThreadPin.room_key == room_key)
    ).unique().first()
    if pin is None or pin.message is None:
        return None
    reactions = aggregate_message_reactions(
        db,
        message_ids=[pin.message_id],
        viewer_user_id=viewer_user_id,
    )
    return DiscussionPinnedMessageResponse(
        message=build_message_response(
            pin.message,
            reactions=reactions.get(pin.message_id, {}),
        ),
        pinned_at=pin.pinned_at,
        pinned_by_name=(
            (pin.pinned_by.full_name if pin.pinned_by else None) or "Member"
        ).strip()
        or "Member",
    )


def pin_discussion_message(
    db: Session,
    *,
    member: Member,
    message_id: int,
) -> DiscussionPinnedMessageResponse:
    message = db.scalars(
        select(DiscussionMessage)
        .options(*_message_load_options())
        .where(DiscussionMessage.id == message_id)
    ).unique().first()
    if message is None:
        raise DiscussionMessageNotFoundError
    if message.deleted_at is not None:
        raise DiscussionValidationError("Deleted messages cannot be pinned")

    if message.custom_room_id is not None:
        from app.services.discussion_room_service import assert_can_access_custom_room

        assert_can_access_custom_room(
            db,
            room_id=message.custom_room_id,
            member=member,
            for_messaging=True,
        )
    elif message.event_id is not None:
        assert_can_access_event_discussion(
            db,
            event_id=message.event_id,
            member=member,
        )
    else:
        assert_can_access_board_discussion(member)

    room_key = room_key_for_message(message)
    existing = db.scalars(
        select(DiscussionThreadPin).where(DiscussionThreadPin.room_key == room_key)
    ).first()
    if existing is not None:
        existing.message_id = message.id
        existing.pinned_by_id = member.id
        existing.pinned_at = datetime.now(UTC)
    else:
        db.add(
            DiscussionThreadPin(
                room_key=room_key,
                message_id=message.id,
                pinned_by_id=member.id,
            )
        )
    db.commit()
    pinned = get_thread_pin(db, room_key=room_key, viewer_user_id=member.id)
    if pinned is None:
        raise DiscussionValidationError("Failed to pin message")
    return pinned


def unpin_discussion_message(
    db: Session,
    *,
    member: Member,
    room_key: str,
) -> None:
    pin = db.scalars(
        select(DiscussionThreadPin).where(DiscussionThreadPin.room_key == room_key)
    ).first()
    if pin is None:
        return
    message = db.get(DiscussionMessage, pin.message_id)
    if message is not None:
        if message.custom_room_id is not None:
            from app.services.discussion_room_service import (
                assert_can_access_custom_room,
            )

            assert_can_access_custom_room(
                db,
                room_id=message.custom_room_id,
                member=member,
                for_messaging=True,
            )
        elif message.event_id is not None:
            assert_can_access_event_discussion(
                db,
                event_id=message.event_id,
                member=member,
            )
        else:
            assert_can_access_board_discussion(member)
    db.delete(pin)
    db.commit()


DEFAULT_SHARED_FILES_LIMIT = 50
MAX_SHARED_FILES_LIMIT = 100


def list_discussion_shared_files(
    db: Session,
    *,
    member: Member,
    room_id: str,
    kind: str | None = None,
    limit: int = DEFAULT_SHARED_FILES_LIMIT,
    offset: int = 0,
) -> DiscussionSharedFileListResponse:
    """List non-deleted message attachments for a discussion room."""
    from app.services.discussion_inbox_service import assert_can_access_room

    scope, ref_id = assert_can_access_room(db, member=member, room_id=room_id)

    capped_limit = max(1, min(limit, MAX_SHARED_FILES_LIMIT))
    capped_offset = max(0, offset)

    filters = [DiscussionMessage.deleted_at.is_(None)]
    if scope == "board":
        filters.extend(
            [
                DiscussionMessage.event_id.is_(None),
                DiscussionMessage.custom_room_id.is_(None),
            ]
        )
    elif scope == "event":
        filters.append(DiscussionMessage.event_id == ref_id)
    else:
        filters.append(DiscussionMessage.custom_room_id == ref_id)

    if kind in {"image", "video", "file", "audio"}:
        filters.append(DiscussionMessageAttachment.kind == kind)

    base = (
        select(DiscussionMessageAttachment)
        .join(
            DiscussionMessage,
            DiscussionMessage.id == DiscussionMessageAttachment.message_id,
        )
        .where(*filters)
    )

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    rows = list(
        db.scalars(
            base.options(
                joinedload(DiscussionMessageAttachment.message).joinedload(
                    DiscussionMessage.author
                )
            )
            .order_by(DiscussionMessageAttachment.created_at.desc())
            .offset(capped_offset)
            .limit(capped_limit)
        )
        .unique()
        .all()
    )

    files: list[DiscussionSharedFileResponse] = []
    for row in rows:
        message = row.message
        author = message.author if message is not None else None
        files.append(
            DiscussionSharedFileResponse(
                id=row.id,
                kind=row.kind,  # type: ignore[arg-type]
                file_name=row.file_name,
                content_type=row.content_type,
                size_bytes=row.size_bytes,
                url=row.url,
                width=row.width,
                height=row.height,
                duration_ms=row.duration_ms,
                created_at=row.created_at,
                message_id=row.message_id,
                author_id=author.id if author is not None else 0,
                author_name=author.full_name if author is not None else "Unknown",
            )
        )

    return DiscussionSharedFileListResponse(files=files, total=total)
