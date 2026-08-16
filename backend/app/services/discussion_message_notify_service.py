"""Create inbox + realtime notifications for new discussion messages."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.discussion_message import DiscussionMessage
from app.models.discussion_room import (
    DiscussionRoom,
    DiscussionRoomKind,
    DiscussionRoomMember,
)
from app.models.discussion_room_mute import DiscussionRoomMute
from app.models.event import Event
from app.models.event_volunteer_signup import EventVolunteerSignup
from app.models.inbox_notification import InboxNotificationType
from app.models.member import Member, MemberRole, MemberStatus
from app.services.discussion_realtime_sync import (
    publish_user_notification,
    user_present_in_room,
)
from app.services.discussion_service import member_can_access_event_discussion
from app.services.discussion_ws_manager import (
    BOARD_ROOM_KEY,
    custom_room_key,
    event_room_key,
)
from app.services.inbox_notification_service import create_inbox_notification

logger = logging.getLogger(__name__)

PREVIEW_MAX_CHARS = 120


def _preview(content: str) -> str:
    cleaned = " ".join(content.split())
    if len(cleaned) <= PREVIEW_MAX_CHARS:
        return cleaned
    return f"{cleaned[: PREVIEW_MAX_CHARS - 1]}…"


def _board_recipients(db: Session) -> list[Member]:
    return list(
        db.scalars(
            select(Member).where(
                Member.status == MemberStatus.APPROVED,
                Member.role.in_(
                    (
                        MemberRole.BOARD,
                        MemberRole.TREASURER,
                        MemberRole.PRESIDENT,
                    )
                ),
            )
        ).all()
    )


def _event_recipients(db: Session, *, event: Event) -> list[Member]:
    recipients: dict[int, Member] = {
        member.id: member for member in _board_recipients(db)
    }
    volunteer_ids = list(
        db.scalars(
            select(EventVolunteerSignup.member_id).where(
                EventVolunteerSignup.event_id == event.id
            )
        ).all()
    )
    if volunteer_ids:
        for member in db.scalars(
            select(Member).where(
                Member.id.in_(volunteer_ids),
                Member.status == MemberStatus.APPROVED,
            )
        ).all():
            if member_can_access_event_discussion(db, event, member):
                recipients[member.id] = member
    return list(recipients.values())


def _custom_room_recipients(db: Session, *, room_id: int) -> list[Member]:
    room = db.scalars(
        select(DiscussionRoom)
        .options(
            joinedload(DiscussionRoom.members).joinedload(DiscussionRoomMember.member)
        )
        .where(DiscussionRoom.id == room_id)
    ).first()
    if room is None:
        return []
    members: list[Member] = []
    for row in room.members:
        member = row.member
        if member is None or member.status != MemberStatus.APPROVED:
            continue
        members.append(member)
    return members


def _muted_user_ids(db: Session, *, user_ids: list[int], room_id: str) -> set[int]:
    if not user_ids:
        return set()
    return set(
        db.scalars(
            select(DiscussionRoomMute.user_id).where(
                DiscussionRoomMute.room_id == room_id,
                DiscussionRoomMute.user_id.in_(user_ids),
            )
        ).all()
    )


def _room_context(
    db: Session,
    *,
    message: DiscussionMessage,
) -> tuple[str, str, str, bool]:
    """Return (room_id, room_label, href, is_dm)."""
    if message.custom_room_id is not None:
        room_id = custom_room_key(message.custom_room_id)
        room = db.get(DiscussionRoom, message.custom_room_id)
        label = room.name if room is not None else "Chat"
        is_dm = bool(room is not None and room.kind == DiscussionRoomKind.DM)
        return room_id, label, f"/discussions/room/{message.custom_room_id}", is_dm
    if message.event_id is not None:
        room_id = event_room_key(message.event_id)
        event = db.get(Event, message.event_id)
        label = event.title if event is not None else "Event discussion"
        return room_id, label, f"/discussions/event/{message.event_id}", False
    return BOARD_ROOM_KEY, "Board Discussion", "/discussions/board", False


def notify_new_discussion_message(
    db: Session,
    *,
    message: DiscussionMessage,
    author: Member,
) -> int:
    """Notify recipients about a newly persisted message. Returns created count."""
    if message.deleted_at is not None:
        return 0

    room_id, room_label, href, is_dm = _room_context(db, message=message)

    if message.custom_room_id is not None:
        recipients = _custom_room_recipients(db, room_id=message.custom_room_id)
    elif message.event_id is not None:
        event = db.get(Event, message.event_id)
        if event is None:
            return 0
        recipients = _event_recipients(db, event=event)
    else:
        recipients = _board_recipients(db)

    recipient_ids = [member.id for member in recipients if member.id != author.id]
    muted_ids = _muted_user_ids(db, user_ids=recipient_ids, room_id=room_id)
    preview = _preview(message.content)
    author_name = (author.full_name or "Member").strip() or "Member"

    pending: list[tuple[Member, object]] = []
    for recipient in recipients:
        if recipient.id == author.id:
            continue
        if recipient.id in muted_ids:
            continue
        # Viewing the thread already — skip noisy inbox/toast (unread still updates).
        if user_present_in_room(room_id, recipient.id):
            continue

        title = author_name if is_dm else f"{author_name} · {room_label}"
        notification = create_inbox_notification(
            db,
            member_id=recipient.id,
            type=InboxNotificationType.DISCUSSION_MESSAGE,
            title=title,
            body=preview,
            href=href,
            dedupe_key=f"discussion_msg:{message.id}:{recipient.id}",
            commit=False,
        )
        if notification is not None:
            pending.append((recipient, notification))

    if not pending:
        return 0

    db.commit()

    for recipient, notification in pending:
        publish_user_notification(
            recipient.id,
            {
                "type": "discussion_message",
                "notification_id": getattr(notification, "id", None),
                "room_id": room_id,
                "title": getattr(notification, "title", author_name),
                "body": getattr(notification, "body", preview),
                "href": href,
                "author_name": author_name,
                "message_id": message.id,
            },
        )
    return len(pending)
