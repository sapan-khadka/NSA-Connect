from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.lib.event_visibility import event_visible_to_member
from app.models.discussion_message import (
    MAX_DISCUSSION_CONTENT_LENGTH,
    DiscussionMessage,
)
from app.models.event import Event
from app.models.member import Member, MemberRole
from app.services.event_service import EventNotFoundError
from app.services.event_volunteer_signup_service import get_member_volunteer_signup

DEFAULT_DISCUSSION_LIMIT = 100
MAX_DISCUSSION_LIMIT = 200


class DiscussionForbiddenError(Exception):
    pass


class DiscussionValidationError(Exception):
    pass


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
