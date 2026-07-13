from collections import defaultdict
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.lib.event_visibility import event_visible_to_member
from app.models.discussion_message import (
    MAX_DISCUSSION_CONTENT_LENGTH,
    DiscussionMessage,
)
from app.models.discussion_message_reaction import DiscussionMessageReaction
from app.models.discussion_read_state import DiscussionReadState
from app.models.event import Event
from app.models.member import Member, MemberRole
from app.schemas.discussion import (
    DiscussionMessageAuthor,
    DiscussionMessageResponse,
    DiscussionReactionSummary,
    DiscussionReadReceiptResponse,
)
from app.services.discussion_ws_manager import (
    BOARD_ROOM_KEY,
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


def _normalize_content(content: str) -> str:
    cleaned = content.strip()
    if not cleaned:
        raise DiscussionValidationError("Message content is required")
    if len(cleaned) > MAX_DISCUSSION_CONTENT_LENGTH:
        raise DiscussionValidationError(
            f"Message must be at most {MAX_DISCUSSION_CONTENT_LENGTH} characters"
        )
    return cleaned


def member_can_access_event_discussion(
    db: Session,
    event: Event,
    member: Member,
) -> bool:
    if not event_visible_to_member(event, member):
        return False
    if member.has_role_at_least(MemberRole.BOARD):
        return True
    return (
        get_member_volunteer_signup(
            db,
            event_id=event.id,
            member_id=member.id,
        )
        is not None
    )


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
    if not member.has_role_at_least(MemberRole.BOARD):
        raise DiscussionForbiddenError


def list_event_discussion_messages(
    db: Session,
    *,
    event_id: int,
    member: Member,
    after_id: int | None = None,
    limit: int = DEFAULT_DISCUSSION_LIMIT,
) -> list[DiscussionMessage]:
    assert_can_access_event_discussion(db, event_id=event_id, member=member)
    return _list_messages(db, event_id=event_id, after_id=after_id, limit=limit)


def list_board_discussion_messages(
    db: Session,
    *,
    member: Member,
    after_id: int | None = None,
    limit: int = DEFAULT_DISCUSSION_LIMIT,
) -> list[DiscussionMessage]:
    assert_can_access_board_discussion(member)
    return _list_messages(db, event_id=None, after_id=after_id, limit=limit)


def _list_messages(
    db: Session,
    *,
    event_id: int | None,
    after_id: int | None,
    limit: int,
) -> list[DiscussionMessage]:
    capped_limit = max(1, min(limit, MAX_DISCUSSION_LIMIT))
    scope_filter = (
        DiscussionMessage.event_id.is_(None)
        if event_id is None
        else DiscussionMessage.event_id == event_id
    )

    if after_id is not None:
        statement = (
            select(DiscussionMessage)
            .options(joinedload(DiscussionMessage.author))
            .where(scope_filter, DiscussionMessage.id > after_id)
            .order_by(DiscussionMessage.id.asc())
            .limit(capped_limit)
        )
        return list(db.scalars(statement).unique().all())

    statement = (
        select(DiscussionMessage)
        .options(joinedload(DiscussionMessage.author))
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
) -> DiscussionMessage:
    assert_can_access_event_discussion(db, event_id=event_id, member=member)
    return _create_message(db, author=member, content=content, event_id=event_id)


def create_board_discussion_message(
    db: Session,
    *,
    member: Member,
    content: str,
) -> DiscussionMessage:
    assert_can_access_board_discussion(member)
    return _create_message(db, author=member, content=content, event_id=None)


def _create_message(
    db: Session,
    *,
    author: Member,
    content: str,
    event_id: int | None,
) -> DiscussionMessage:
    message = DiscussionMessage(
        content=_normalize_content(content),
        author_id=author.id,
        event_id=event_id,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    _ = message.author
    return message


def build_message_response(
    message: DiscussionMessage,
    *,
    reactions: dict[str, DiscussionReactionSummary] | None = None,
) -> DiscussionMessageResponse:
    return DiscussionMessageResponse(
        id=message.id,
        content=message.content,
        event_id=message.event_id,
        created_at=message.created_at,
        author=DiscussionMessageAuthor.model_validate(message.author),
        reactions=reactions or {},
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
) -> bool:
    """Persist a reaction add/remove. Returns True if the DB row changed."""
    cleaned = emoji.strip()
    if cleaned not in ALLOWED_DISCUSSION_REACTION_EMOJIS:
        raise DiscussionValidationError("Unsupported reaction emoji")

    if room_event_id is None:
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

    if room_event_id is None:
        if message.event_id is not None:
            raise DiscussionMessageNotFoundError
    elif message.event_id != room_event_id:
        raise DiscussionMessageNotFoundError

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
) -> None:
    if room_event_id is None:
        if message.event_id is not None:
            raise DiscussionMessageNotFoundError
    elif message.event_id != room_event_id:
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


def upsert_discussion_read_state(
    db: Session,
    *,
    member: Member,
    room_id: str,
    last_read_message_id: int,
    room_event_id: int | None,
) -> DiscussionReadReceiptResponse | None:
    """Advance the user's read watermark. Returns None if unchanged/backwards."""
    if room_event_id is None:
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
    _assert_message_in_room(message, room_event_id=room_event_id)

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
    return _read_receipt_response(existing, member)
