"""Inbox summary: room list, unread counts, pins, and last-read timestamps."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.discussion_message import DiscussionMessage
from app.models.discussion_room_archive import DiscussionRoomArchive
from app.models.discussion_room_mute import DiscussionRoomMute
from app.models.discussion_room_pin import DiscussionRoomPin
from app.models.discussion_room_read import DiscussionRoomRead
from app.models.discussion_room_user_archive import DiscussionRoomUserArchive
from app.models.event import Event
from app.models.event_volunteer_signup import EventVolunteerSignup
from app.models.member import Member, MemberRole
from app.schemas.discussion import (
    DiscussionArchiveResponse,
    DiscussionArchivedRoomResponse,
    DiscussionInboxResponse,
    DiscussionInboxRoomResponse,
    DiscussionMuteToggleResponse,
    DiscussionPinToggleResponse,
    DiscussionRoomReadResponse,
    DiscussionUserArchiveToggleResponse,
)
from app.services.discussion_service import (
    DiscussionForbiddenError,
    DiscussionValidationError,
    member_can_access_event_discussion,
)
from app.services.discussion_ws_manager import (
    BOARD_ROOM_KEY,
    custom_room_key,
    event_room_key,
)
from app.services.event_service import EventNotFoundError

BOARD_ROOM_LABEL = "Board Discussion"
UNREAD_DISPLAY_CAP = 9
PREVIEW_MAX_CHARS = 120


def parse_discussion_room_id(room_id: str) -> tuple[str, int | None]:
    """Return ('board', None), ('event', event_id), or ('room', custom_room_id)."""
    cleaned = room_id.strip()
    if cleaned == BOARD_ROOM_KEY:
        return "board", None
    if cleaned.startswith("event:"):
        raw = cleaned.removeprefix("event:")
        try:
            event_id = int(raw)
        except ValueError as exc:
            raise DiscussionValidationError("Invalid room_id") from exc
        if event_id < 1:
            raise DiscussionValidationError("Invalid room_id")
        return "event", event_id
    if cleaned.startswith("room:"):
        raw = cleaned.removeprefix("room:")
        try:
            custom_id = int(raw)
        except ValueError as exc:
            raise DiscussionValidationError("Invalid room_id") from exc
        if custom_id < 1:
            raise DiscussionValidationError("Invalid room_id")
        return "room", custom_id
    raise DiscussionValidationError("Invalid room_id")


def assert_can_access_room(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> tuple[str, int | None]:
    kind, ref_id = parse_discussion_room_id(room_id)
    if kind == "board":
        if not member.has_role_at_least(MemberRole.BOARD):
            raise DiscussionForbiddenError
        return kind, ref_id

    if kind == "room":
        from app.services.discussion_room_service import assert_can_access_custom_room

        assert ref_id is not None
        assert_can_access_custom_room(db, room_id=ref_id, member=member)
        return kind, ref_id

    assert ref_id is not None
    event = db.get(Event, ref_id)
    if event is None:
        raise EventNotFoundError
    if not member_can_access_event_discussion(db, event, member):
        raise DiscussionForbiddenError
    return kind, ref_id


def is_system_room_archived(db: Session, room_id: str) -> bool:
    cleaned = room_id.strip()
    return (
        db.scalars(
            select(DiscussionRoomArchive.id).where(
                DiscussionRoomArchive.room_id == cleaned
            )
        ).first()
        is not None
    )


def assert_system_room_not_archived(db: Session, room_id: str) -> None:
    if is_system_room_archived(db, room_id):
        raise DiscussionValidationError("This discussion has been archived")


def _archived_system_room_ids(db: Session) -> set[str]:
    return set(db.scalars(select(DiscussionRoomArchive.room_id)).all())


def archive_inbox_room(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> DiscussionArchiveResponse:
    """Archive board, event, or custom discussion (President / VP only)."""
    from app.services.discussion_room_service import can_review_discussion_rooms

    if not can_review_discussion_rooms(member):
        raise DiscussionForbiddenError

    cleaned = room_id.strip()
    kind, ref_id = assert_can_access_room(db, member=member, room_id=cleaned)

    if kind == "room":
        from app.services.discussion_room_service import archive_discussion_room

        assert ref_id is not None
        archive_discussion_room(db, room_id=ref_id, actor=member)
        return DiscussionArchiveResponse(room_id=cleaned, archived=True)

    if is_system_room_archived(db, cleaned):
        return DiscussionArchiveResponse(room_id=cleaned, archived=True)

    db.add(
        DiscussionRoomArchive(
            room_id=cleaned,
            archived_by_id=member.id,
            archived_at=datetime.now(UTC),
        )
    )
    db.commit()
    return DiscussionArchiveResponse(room_id=cleaned, archived=True)


def unarchive_inbox_room(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> DiscussionArchiveResponse:
    """Restore an archived discussion to the inbox (President / VP only)."""
    from app.services.discussion_room_service import (
        can_review_discussion_rooms,
        unarchive_discussion_room,
    )

    if not can_review_discussion_rooms(member):
        raise DiscussionForbiddenError

    cleaned = room_id.strip()
    kind, ref_id = parse_discussion_room_id(cleaned)

    if kind == "room":
        assert ref_id is not None
        unarchive_discussion_room(db, room_id=ref_id, actor=member)
        return DiscussionArchiveResponse(room_id=cleaned, archived=False)

    assert_can_access_room(db, member=member, room_id=cleaned)
    existing = db.scalars(
        select(DiscussionRoomArchive).where(DiscussionRoomArchive.room_id == cleaned)
    ).first()
    if existing is not None:
        db.delete(existing)
        db.commit()
    return DiscussionArchiveResponse(room_id=cleaned, archived=False)


def list_archived_rooms_for_oversight(
    db: Session,
    *,
    member: Member,
) -> list[DiscussionArchivedRoomResponse]:
    from app.services.discussion_room_service import (
        can_review_discussion_rooms,
        list_archived_custom_rooms,
    )

    if not can_review_discussion_rooms(member):
        return []

    archived: list[DiscussionArchivedRoomResponse] = []
    system_rows = list(
        db.scalars(
            select(DiscussionRoomArchive).order_by(
                DiscussionRoomArchive.archived_at.desc()
            )
        ).all()
    )
    event_ids = [
        ref
        for kind, ref in (
            parse_discussion_room_id(row.room_id) for row in system_rows
        )
        if kind == "event" and ref is not None
    ]
    events = {
        event.id: event
        for event in db.scalars(select(Event).where(Event.id.in_(event_ids))).all()
    } if event_ids else {}

    for row in system_rows:
        kind, ref_id = parse_discussion_room_id(row.room_id)
        if kind == "board":
            archived.append(
                DiscussionArchivedRoomResponse(
                    room_id=row.room_id,
                    label=BOARD_ROOM_LABEL,
                    href="/discussions/board",
                    kind="board",
                    archived_at=row.archived_at,
                )
            )
        elif kind == "event" and ref_id is not None:
            event = events.get(ref_id)
            archived.append(
                DiscussionArchivedRoomResponse(
                    room_id=row.room_id,
                    label=event.title if event else f"Event {ref_id}",
                    href=f"/discussions/event/{ref_id}",
                    kind="event",
                    archived_at=row.archived_at,
                )
            )

    for custom in list_archived_custom_rooms(db):
        archived.append(
            DiscussionArchivedRoomResponse(
                room_id=custom_room_key(custom.id),
                label=custom.name,
                href=f"/discussions/room/{custom.id}",
                kind="room",
                archived_at=custom.reviewed_at or custom.created_at,
            )
        )

    archived.sort(
        key=lambda room: (
            -(room.archived_at.timestamp() if room.archived_at else 0.0),
            room.label.lower(),
        )
    )
    return archived


def _preview_text(content: str) -> str:
    single = " ".join(content.split())
    if len(single) <= PREVIEW_MAX_CHARS:
        return single
    return f"{single[: PREVIEW_MAX_CHARS - 1].rstrip()}…"


def _preview_for_message(message: DiscussionMessage) -> str:
    if message.deleted_at is not None:
        return "This message was deleted"
    return _preview_text(message.content)


def _unread_display(count: int) -> str | None:
    if count <= 0:
        return None
    if count > UNREAD_DISPLAY_CAP:
        return f"{UNREAD_DISPLAY_CAP}+"
    return str(count)


def _mention_needles(member: Member) -> list[str]:
    full = (member.full_name or "").strip()
    if not full:
        return []
    needles = [f"@{full}"]
    first = full.split()[0]
    if first and first.casefold() != full.casefold():
        needles.append(f"@{first}")
    return needles


def _content_mentions_member(content: str, needles: list[str]) -> bool:
    """Best-effort match for `@Full Name` / `@First` tokens in message text."""
    if not content or not needles:
        return False
    text = content.casefold()
    for needle in needles:
        target = needle.casefold()
        start = 0
        while True:
            idx = text.find(target, start)
            if idx < 0:
                break
            end = idx + len(target)
            # Require a token boundary so `@Muk` does not match `@Mukesh`.
            if end >= len(text) or not (text[end].isalnum() or text[end] in "._"):
                return True
            start = idx + 1
    return False


def _message_scope(
    *,
    event_id: int | None,
    custom_room_id: int | None = None,
):
    if custom_room_id is not None:
        return and_(
            DiscussionMessage.custom_room_id == custom_room_id,
            DiscussionMessage.event_id.is_(None),
        )
    if event_id is None:
        return and_(
            DiscussionMessage.event_id.is_(None),
            DiscussionMessage.custom_room_id.is_(None),
        )
    return and_(
        DiscussionMessage.event_id == event_id,
        DiscussionMessage.custom_room_id.is_(None),
    )


_LOW_VALUE_ACK = re.compile(
    r"^(ok|okay|k|kk|yes|yep|yeah|y|no|nah|n|thanks|thank you|ty|thx|np|"
    r"sure|cool|nice|lol|lmao|haha|hehe|same|true|false|done|noted|"
    r"👍|🙏|❤️|❤|🔥|😂|😊|👌|💯|✅|👏|🙌|✨)[.!]*$",
    re.IGNORECASE,
)


def _is_low_value_content(content: str) -> bool:
    """True for empty/ack/emoji-only chatter that shouldn't lead a dashboard card."""
    text = (content or "").strip()
    if not text:
        return True
    if len(text) <= 2:
        return True
    if _LOW_VALUE_ACK.match(text):
        return True
    # No letters/digits → sticker / emoji-only.
    if re.search(r"[^\W_]", text, flags=re.UNICODE) is None:
        return True
    return False


@dataclass(frozen=True)
class _UnreadAttention:
    mentions_you: bool
    preview: str | None
    author: str | None


def _unread_attention(
    db: Session,
    *,
    member: Member,
    event_id: int | None,
    custom_room_id: int | None = None,
    last_read_at: datetime | None,
) -> _UnreadAttention:
    """Find mention + useful snippet without scanning large unread histories."""
    scope = _message_scope(event_id=event_id, custom_room_id=custom_room_id)
    base = [
        scope,
        DiscussionMessage.author_id != member.id,
        DiscussionMessage.deleted_at.is_(None),
    ]
    if last_read_at is not None:
        base.append(DiscussionMessage.created_at > last_read_at)

    needles = _mention_needles(member)
    mention_msg: DiscussionMessage | None = None
    if needles:
        mention_filters = [
            DiscussionMessage.content.ilike(f"%{needle}%") for needle in needles
        ]
        mention_msg = db.scalars(
            select(DiscussionMessage)
            .options(joinedload(DiscussionMessage.author))
            .where(*base, or_(*mention_filters))
            .order_by(DiscussionMessage.id.desc())
            .limit(1)
        ).first()
        # Guard against partial false positives from ILIKE (e.g. @Muk vs @Mukesh).
        if mention_msg is not None and not _content_mentions_member(
            str(mention_msg.content or ""), needles
        ):
            mention_msg = None

    if mention_msg is not None:
        return _UnreadAttention(
            mentions_you=True,
            preview=_preview_for_message(mention_msg),
            author=(
                mention_msg.author.full_name if mention_msg.author is not None else None
            ),
        )

    recent = db.scalars(
        select(DiscussionMessage)
        .options(joinedload(DiscussionMessage.author))
        .where(*base)
        .order_by(DiscussionMessage.id.desc())
        .limit(8)
    ).unique().all()

    substantive_msg: DiscussionMessage | None = None
    latest_msg: DiscussionMessage | None = None
    for message in recent:
        if latest_msg is None:
            latest_msg = message
        if substantive_msg is None and not _is_low_value_content(
            str(message.content or "")
        ):
            substantive_msg = message
            break

    chosen = substantive_msg or latest_msg
    return _UnreadAttention(
        mentions_you=False,
        preview=_preview_for_message(chosen) if chosen is not None else None,
        author=(
            chosen.author.full_name
            if chosen is not None and chosen.author is not None
            else None
        ),
    )


def mark_discussion_room_read(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> DiscussionRoomReadResponse:
    cleaned = room_id.strip()
    assert_can_access_room(db, member=member, room_id=cleaned)
    now = datetime.now(UTC)

    existing = db.scalars(
        select(DiscussionRoomRead).where(
            DiscussionRoomRead.user_id == member.id,
            DiscussionRoomRead.room_id == cleaned,
        )
    ).first()
    if existing is None:
        existing = DiscussionRoomRead(
            user_id=member.id,
            room_id=cleaned,
            last_read_at=now,
        )
        db.add(existing)
        try:
            db.commit()
        except IntegrityError:
            # Concurrent first-read inserts for the same (user, room) are fine.
            db.rollback()
            existing = db.scalars(
                select(DiscussionRoomRead).where(
                    DiscussionRoomRead.user_id == member.id,
                    DiscussionRoomRead.room_id == cleaned,
                )
            ).first()
            if existing is None:
                raise
            existing.last_read_at = now
            db.commit()
    else:
        existing.last_read_at = now
        db.commit()

    db.refresh(existing)
    return DiscussionRoomReadResponse(
        room_id=existing.room_id,
        last_read_at=existing.last_read_at,
    )


def sync_inbox_read_watermark(
    db: Session,
    *,
    member: Member,
    room_id: str,
    last_read_message_id: int,
    last_read_at: datetime,
) -> None:
    """Advance inbox unread watermark from a live read receipt (no access re-check)."""
    existing = db.scalars(
        select(DiscussionRoomRead).where(
            DiscussionRoomRead.user_id == member.id,
            DiscussionRoomRead.room_id == room_id,
        )
    ).first()
    if existing is None:
        existing = DiscussionRoomRead(
            user_id=member.id,
            room_id=room_id,
            last_read_at=last_read_at,
            last_read_message_id=last_read_message_id,
        )
        db.add(existing)
    else:
        if (
            existing.last_read_at is None
            or last_read_at > existing.last_read_at
        ):
            existing.last_read_at = last_read_at
        if (
            existing.last_read_message_id is None
            or last_read_message_id > existing.last_read_message_id
        ):
            existing.last_read_message_id = last_read_message_id
    db.commit()


def toggle_discussion_room_pin(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> DiscussionPinToggleResponse:
    cleaned = room_id.strip()
    assert_can_access_room(db, member=member, room_id=cleaned)

    existing = db.scalars(
        select(DiscussionRoomPin).where(
            DiscussionRoomPin.user_id == member.id,
            DiscussionRoomPin.room_id == cleaned,
        )
    ).first()

    if existing is not None:
        db.delete(existing)
        db.commit()
        return DiscussionPinToggleResponse(room_id=cleaned, pinned=False)

    pin = DiscussionRoomPin(
        user_id=member.id,
        room_id=cleaned,
        pinned_at=datetime.now(UTC),
    )
    db.add(pin)
    db.commit()
    return DiscussionPinToggleResponse(room_id=cleaned, pinned=True)


def toggle_discussion_room_mute(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> DiscussionMuteToggleResponse:
    cleaned = room_id.strip()
    assert_can_access_room(db, member=member, room_id=cleaned)

    existing = db.scalars(
        select(DiscussionRoomMute).where(
            DiscussionRoomMute.user_id == member.id,
            DiscussionRoomMute.room_id == cleaned,
        )
    ).first()

    if existing is not None:
        db.delete(existing)
        db.commit()
        return DiscussionMuteToggleResponse(room_id=cleaned, muted=False)

    mute = DiscussionRoomMute(
        user_id=member.id,
        room_id=cleaned,
        muted_at=datetime.now(UTC),
    )
    db.add(mute)
    db.commit()
    return DiscussionMuteToggleResponse(room_id=cleaned, muted=True)


def toggle_discussion_room_user_archive(
    db: Session,
    *,
    member: Member,
    room_id: str,
) -> DiscussionUserArchiveToggleResponse:
    """Hide/show a room on this member's inbox only (not chapter-wide)."""
    cleaned = room_id.strip()
    assert_can_access_room(db, member=member, room_id=cleaned)

    existing = db.scalars(
        select(DiscussionRoomUserArchive).where(
            DiscussionRoomUserArchive.user_id == member.id,
            DiscussionRoomUserArchive.room_id == cleaned,
        )
    ).first()

    if existing is not None:
        db.delete(existing)
        db.commit()
        return DiscussionUserArchiveToggleResponse(
            room_id=cleaned,
            archived_for_me=False,
        )

    # Pinning and personal-archive conflict: prefer archive-for-me.
    pin = db.scalars(
        select(DiscussionRoomPin).where(
            DiscussionRoomPin.user_id == member.id,
            DiscussionRoomPin.room_id == cleaned,
        )
    ).first()
    if pin is not None:
        db.delete(pin)

    db.add(
        DiscussionRoomUserArchive(
            user_id=member.id,
            room_id=cleaned,
            archived_at=datetime.now(UTC),
        )
    )
    db.commit()
    return DiscussionUserArchiveToggleResponse(
        room_id=cleaned,
        archived_for_me=True,
    )


def _count_unread(
    db: Session,
    *,
    member_id: int,
    event_id: int | None,
    custom_room_id: int | None = None,
    last_read_at: datetime | None,
) -> int:
    statement = (
        select(func.count())
        .select_from(DiscussionMessage)
        .where(
            _message_scope(event_id=event_id, custom_room_id=custom_room_id),
            DiscussionMessage.author_id != member_id,
            DiscussionMessage.deleted_at.is_(None),
        )
    )
    if last_read_at is not None:
        statement = statement.where(DiscussionMessage.created_at > last_read_at)
    return int(db.scalar(statement) or 0)


def _latest_message(
    db: Session,
    *,
    event_id: int | None,
    custom_room_id: int | None = None,
) -> DiscussionMessage | None:
    return db.scalars(
        select(DiscussionMessage)
        .options(joinedload(DiscussionMessage.author))
        .where(_message_scope(event_id=event_id, custom_room_id=custom_room_id))
        .order_by(DiscussionMessage.id.desc())
        .limit(1)
    ).first()


def list_discussion_inbox(
    db: Session,
    *,
    member: Member,
) -> DiscussionInboxResponse:
    reads = {
        row.room_id: row.last_read_at
        for row in db.scalars(
            select(DiscussionRoomRead).where(DiscussionRoomRead.user_id == member.id)
        ).all()
    }
    pins = {
        row.room_id: row.pinned_at
        for row in db.scalars(
            select(DiscussionRoomPin).where(DiscussionRoomPin.user_id == member.id)
        ).all()
    }
    muted_ids = set(
        db.scalars(
            select(DiscussionRoomMute.room_id).where(
                DiscussionRoomMute.user_id == member.id
            )
        ).all()
    )
    personal_archived_ids = set(
        db.scalars(
            select(DiscussionRoomUserArchive.room_id).where(
                DiscussionRoomUserArchive.user_id == member.id
            )
        ).all()
    )

    from app.services.discussion_realtime_sync import users_online

    rooms: list[DiscussionInboxRoomResponse] = []
    archived_ids = _archived_system_room_ids(db)
    peer_ids_for_presence: list[int] = []

    if member.has_role_at_least(MemberRole.BOARD):
        latest = _latest_message(db, event_id=None)
        if latest is not None and BOARD_ROOM_KEY not in archived_ids:
            room_id = BOARD_ROOM_KEY
            last_read_at = reads.get(room_id)
            unread = _count_unread(
                db,
                member_id=member.id,
                event_id=None,
                last_read_at=last_read_at,
            )
            attention = (
                _unread_attention(
                    db,
                    member=member,
                    event_id=None,
                    last_read_at=last_read_at,
                )
                if unread > 0
                else _UnreadAttention(False, None, None)
            )
            rooms.append(
                DiscussionInboxRoomResponse(
                    room_id=room_id,
                    label=BOARD_ROOM_LABEL,
                    event_id=None,
                    event_type=None,
                    href="/discussions/board",
                    last_message_preview=_preview_for_message(latest),
                    last_message_at=latest.created_at,
                    last_message_author=latest.author.full_name
                    if latest.author
                    else None,
                    unread_count=unread,
                    unread_display=_unread_display(unread),
                    mentions_you=attention.mentions_you,
                    attention_preview=attention.preview,
                    attention_author=attention.author,
                    pinned=room_id in pins,
                    pinned_at=pins.get(room_id),
                    muted=room_id in muted_ids,
                )
            )

    event_ids_with_messages = list(
        db.scalars(
            select(DiscussionMessage.event_id)
            .where(DiscussionMessage.event_id.is_not(None))
            .distinct()
        ).all()
    )

    accessible_event_ids: set[int] = set()
    if member.has_role_at_least(MemberRole.BOARD):
        accessible_event_ids = {int(eid) for eid in event_ids_with_messages if eid}
    else:
        volunteer_event_ids = set(
            db.scalars(
                select(EventVolunteerSignup.event_id).where(
                    EventVolunteerSignup.member_id == member.id
                )
            ).all()
        )
        accessible_event_ids = {
            int(eid)
            for eid in event_ids_with_messages
            if eid is not None and eid in volunteer_event_ids
        }

    if accessible_event_ids:
        events = {
            event.id: event
            for event in db.scalars(
                select(Event).where(Event.id.in_(accessible_event_ids))
            ).all()
        }
        for event_id in accessible_event_ids:
            event = events.get(event_id)
            if event is None:
                continue
            if not member_can_access_event_discussion(db, event, member):
                continue
            room_id = event_room_key(event_id)
            if room_id in archived_ids:
                continue
            latest = _latest_message(db, event_id=event_id)
            if latest is None:
                continue
            last_read_at = reads.get(room_id)
            unread = _count_unread(
                db,
                member_id=member.id,
                event_id=event_id,
                last_read_at=last_read_at,
            )
            attention = (
                _unread_attention(
                    db,
                    member=member,
                    event_id=event_id,
                    last_read_at=last_read_at,
                )
                if unread > 0
                else _UnreadAttention(False, None, None)
            )
            rooms.append(
                DiscussionInboxRoomResponse(
                    room_id=room_id,
                    label=event.title,
                    event_id=event_id,
                    event_type=str(event.event_type.value)
                    if hasattr(event.event_type, "value")
                    else str(event.event_type),
                    href=f"/discussions/event/{event_id}",
                    last_message_preview=_preview_for_message(latest),
                    last_message_at=latest.created_at,
                    last_message_author=latest.author.full_name
                    if latest.author
                    else None,
                    unread_count=unread,
                    unread_display=_unread_display(unread),
                    mentions_you=attention.mentions_you,
                    attention_preview=attention.preview,
                    attention_author=attention.author,
                    pinned=room_id in pins,
                    pinned_at=pins.get(room_id),
                    muted=room_id in muted_ids,
                )
            )

    from app.models.discussion_room import DiscussionRoomKind
    from app.services.discussion_room_service import list_live_rooms_for_member

    is_board = member.has_role_at_least(MemberRole.BOARD)
    dm_peer_by_room: dict[str, int] = {}
    for custom in list_live_rooms_for_member(db, member=member):
        is_dm = custom.kind == DiscussionRoomKind.DM
        if not is_dm and not is_board:
            continue

        room_id = custom_room_key(custom.id)
        latest = _latest_message(db, event_id=None, custom_room_id=custom.id)
        last_read_at = reads.get(room_id)
        unread = _count_unread(
            db,
            member_id=member.id,
            event_id=None,
            custom_room_id=custom.id,
            last_read_at=last_read_at,
        )
        attention = (
            _unread_attention(
                db,
                member=member,
                event_id=None,
                custom_room_id=custom.id,
                last_read_at=last_read_at,
            )
            if unread > 0
            else _UnreadAttention(False, None, None)
        )

        label = custom.name
        peer_user_id: int | None = None
        peer_avatar_url: str | None = None
        if is_dm:
            peer = next(
                (
                    row.member
                    for row in custom.members
                    if row.member_id != member.id and row.member is not None
                ),
                None,
            )
            label = peer.full_name if peer else "Direct message"
            if peer is not None:
                peer_user_id = peer.id
                peer_avatar_url = peer.avatar_url
                peer_ids_for_presence.append(peer.id)
                dm_peer_by_room[room_id] = peer.id

        rooms.append(
            DiscussionInboxRoomResponse(
                room_id=room_id,
                label=label,
                event_id=None,
                event_type="dm" if is_dm else "group",
                href=f"/discussions/room/{custom.id}",
                last_message_preview=_preview_for_message(latest)
                if latest
                else None,
                last_message_at=latest.created_at if latest else custom.created_at,
                last_message_author=latest.author.full_name
                if latest and latest.author
                else None,
                unread_count=unread,
                unread_display=_unread_display(unread),
                mentions_you=attention.mentions_you,
                attention_preview=attention.preview,
                attention_author=attention.author,
                pinned=room_id in pins,
                pinned_at=pins.get(room_id),
                muted=room_id in muted_ids,
                peer_user_id=peer_user_id,
                peer_avatar_url=peer_avatar_url,
                avatar_url=None if is_dm else custom.avatar_url,
            )
        )

    online_map = users_online(peer_ids_for_presence)
    if online_map and dm_peer_by_room:
        updated_rooms: list[DiscussionInboxRoomResponse] = []
        for room in rooms:
            peer_id = dm_peer_by_room.get(room.room_id)
            if peer_id is None:
                updated_rooms.append(room)
                continue
            updated_rooms.append(
                room.model_copy(update={"peer_online": bool(online_map.get(peer_id))})
            )
        rooms = updated_rooms

    def sort_key(room: DiscussionInboxRoomResponse):
        if room.pinned and room.pinned_at is not None:
            # Keep Board Discussion first among pins.
            board_rank = 0 if room.room_id == BOARD_ROOM_KEY else 1
            return (0, board_rank, -room.pinned_at.timestamp(), room.label.lower())
        last_ts = room.last_message_at.timestamp() if room.last_message_at else 0.0
        return (1, 0, -last_ts, room.label.lower())

    active_rooms: list[DiscussionInboxRoomResponse] = []
    personal_archived_rooms: list[DiscussionInboxRoomResponse] = []
    for room in rooms:
        if room.room_id in personal_archived_ids:
            personal_archived_rooms.append(
                room.model_copy(update={"archived_for_me": True, "pinned": False})
            )
        else:
            active_rooms.append(room)

    active_rooms.sort(key=sort_key)
    personal_archived_rooms.sort(key=sort_key)
    return DiscussionInboxResponse(
        rooms=active_rooms,
        archived_rooms=list_archived_rooms_for_oversight(db, member=member),
        personal_archived_rooms=personal_archived_rooms,
    )
