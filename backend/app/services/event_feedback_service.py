from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.event_feedback import EventFeedback
from app.schemas.event_feedback import (
    EventFeedbackCreateRequest,
    EventFeedbackListResponse,
    EventFeedbackMemberResponse,
    EventFeedbackResponse,
)
from app.services.event_service import EventNotFoundError


class EventNotPastError(Exception):
    pass


def _normalize_comment(comment: str | None) -> str | None:
    if comment is None:
        return None
    trimmed = comment.strip()
    return trimmed or None


def _ensure_event_is_past(event: Event) -> None:
    if event.is_upcoming:
        raise EventNotPastError


def get_member_event_feedback(
    db: Session,
    *,
    event_id: int,
    member_id: int,
) -> EventFeedback | None:
    return db.scalar(
        select(EventFeedback).where(
            EventFeedback.event_id == event_id,
            EventFeedback.member_id == member_id,
        ),
    )


def submit_event_feedback(
    db: Session,
    *,
    event_id: int,
    member_id: int,
    data: EventFeedbackCreateRequest,
) -> EventFeedback:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    _ensure_event_is_past(event)

    comment = _normalize_comment(data.comment)
    existing = get_member_event_feedback(db, event_id=event_id, member_id=member_id)
    if existing is not None:
        existing.rating = data.rating
        existing.comment = comment
        db.commit()
        db.refresh(existing)
        return existing

    feedback = EventFeedback(
        event_id=event_id,
        member_id=member_id,
        rating=data.rating,
        comment=comment,
        created_at=datetime.now(UTC),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


def list_event_feedback(db: Session, event_id: int) -> EventFeedbackListResponse:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    rows = db.scalars(
        select(EventFeedback)
        .where(EventFeedback.event_id == event_id)
        .options(selectinload(EventFeedback.member))
        .order_by(EventFeedback.created_at.desc()),
    ).all()

    feedback = [
        EventFeedbackMemberResponse(
            id=row.id,
            member_id=row.member_id,
            full_name=row.member.full_name,
            rating=row.rating,
            comment=row.comment,
            created_at=row.created_at,
        )
        for row in rows
    ]

    average_rating = 0.0
    if feedback:
        average_rating = round(sum(entry.rating for entry in feedback) / len(feedback), 1)

    return EventFeedbackListResponse(
        feedback=feedback,
        total=len(feedback),
        average_rating=average_rating,
    )


def to_member_response(feedback: EventFeedback) -> EventFeedbackResponse:
    return EventFeedbackResponse(
        id=feedback.id,
        event_id=feedback.event_id,
        rating=feedback.rating,
        comment=feedback.comment,
        created_at=feedback.created_at,
    )
