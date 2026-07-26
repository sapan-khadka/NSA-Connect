from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.event_suggestion_comment import (
    DELETED_IDEA_COMMENT_PLACEHOLDER,
    MAX_IDEA_COMMENT_LENGTH,
    EventSuggestionComment,
)
from app.models.member import Member, MemberRole
from app.schemas.event_suggestion import EventSuggestionCommentCreateRequest
from app.services.event_suggestion_service import (
    INTEREST_OPEN_STATUSES,
    EventSuggestionNotFoundError,
    get_event_suggestion,
)

DISCUSSION_OPEN_STATUSES = INTEREST_OPEN_STATUSES


class EventSuggestionCommentNotFoundError(Exception):
    pass


class EventSuggestionCommentClosedError(Exception):
    pass


class EventSuggestionCommentForbiddenError(Exception):
    pass


class EventSuggestionCommentInvalidParentError(Exception):
    pass


class EventSuggestionCommentEmptyError(Exception):
    pass


def _load_comment(db: Session, comment_id: int) -> EventSuggestionComment | None:
    return db.scalar(
        select(EventSuggestionComment)
        .where(EventSuggestionComment.id == comment_id)
        .options(joinedload(EventSuggestionComment.author))
    )


def list_event_suggestion_comments(
    db: Session,
    *,
    suggestion_id: int,
) -> list[EventSuggestionComment]:
    get_event_suggestion(db, suggestion_id=suggestion_id)
    return list(
        db.scalars(
            select(EventSuggestionComment)
            .where(EventSuggestionComment.suggestion_id == suggestion_id)
            .options(joinedload(EventSuggestionComment.author))
            .order_by(EventSuggestionComment.created_at.asc()),
        ).all()
    )


def create_event_suggestion_comment(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
    data: EventSuggestionCommentCreateRequest,
) -> EventSuggestionComment:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id)
    if suggestion.status not in DISCUSSION_OPEN_STATUSES:
        raise EventSuggestionCommentClosedError

    content = data.content.strip()
    if not content:
        raise EventSuggestionCommentEmptyError
    if len(content) > MAX_IDEA_COMMENT_LENGTH:
        content = content[:MAX_IDEA_COMMENT_LENGTH]

    parent_id = data.parent_id
    if parent_id is not None:
        parent = _load_comment(db, parent_id)
        if (
            parent is None
            or parent.suggestion_id != suggestion_id
            or parent.parent_id is not None
            or parent.deleted_at is not None
        ):
            raise EventSuggestionCommentInvalidParentError

    now = datetime.now(UTC)
    comment = EventSuggestionComment(
        suggestion_id=suggestion_id,
        author_id=member.id,
        parent_id=parent_id,
        content=content,
        created_at=now,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    loaded = _load_comment(db, comment.id)
    if loaded is None:
        raise EventSuggestionCommentNotFoundError
    return loaded


def soft_delete_event_suggestion_comment(
    db: Session,
    *,
    suggestion_id: int,
    comment_id: int,
    member: Member,
) -> EventSuggestionComment:
    get_event_suggestion(db, suggestion_id=suggestion_id)
    comment = _load_comment(db, comment_id)
    if comment is None or comment.suggestion_id != suggestion_id:
        raise EventSuggestionCommentNotFoundError

    can_delete = comment.author_id == member.id or member.has_role_at_least(
        MemberRole.BOARD
    )
    if not can_delete:
        raise EventSuggestionCommentForbiddenError

    if comment.deleted_at is None:
        comment.deleted_at = datetime.now(UTC)
        comment.content = ""
        db.commit()
        db.refresh(comment)

    loaded = _load_comment(db, comment.id)
    if loaded is None:
        raise EventSuggestionCommentNotFoundError
    return loaded


def comment_display_content(comment: EventSuggestionComment) -> str:
    if comment.deleted_at is not None:
        return DELETED_IDEA_COMMENT_PLACEHOLDER
    return comment.content


def build_comment_threads(
    comments: list[EventSuggestionComment],
) -> tuple[list[EventSuggestionComment], dict[int, list[EventSuggestionComment]], int]:
    """Return top-level comments, replies by parent id, and live (non-deleted) total."""
    top_level: list[EventSuggestionComment] = []
    replies: dict[int, list[EventSuggestionComment]] = {}
    live_total = 0

    for comment in comments:
        if comment.deleted_at is None:
            live_total += 1
        if comment.parent_id is None:
            top_level.append(comment)
        else:
            replies.setdefault(comment.parent_id, []).append(comment)

    return top_level, replies, live_total
