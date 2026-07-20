from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.member import Member
from app.schemas.event_suggestion import EventSuggestionCreateRequest


class EventSuggestionNotFoundError(Exception):
    pass


def _load_suggestion(db: Session, suggestion_id: int) -> EventSuggestion | None:
    return db.scalar(
        select(EventSuggestion)
        .where(EventSuggestion.id == suggestion_id)
        .options(
            joinedload(EventSuggestion.suggested_by),
            joinedload(EventSuggestion.noted_by),
        ),
    )


def list_event_suggestions(db: Session) -> list[EventSuggestion]:
    return list(
        db.scalars(
            select(EventSuggestion)
            .options(
                joinedload(EventSuggestion.suggested_by),
                joinedload(EventSuggestion.noted_by),
            )
            .order_by(EventSuggestion.created_at.desc()),
        ).all(),
    )


def create_event_suggestion(
    db: Session,
    *,
    member: Member,
    data: EventSuggestionCreateRequest,
) -> EventSuggestion:
    now = datetime.now(UTC)
    preferred_timing = data.preferred_timing.strip() if data.preferred_timing else None
    if preferred_timing == "":
        preferred_timing = None

    suggestion = EventSuggestion(
        title=data.title.strip(),
        description=data.description.strip(),
        preferred_timing=preferred_timing,
        status=EventSuggestionStatus.SUBMITTED,
        suggested_by_id=member.id,
        created_at=now,
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)

    loaded = _load_suggestion(db, suggestion.id)
    if loaded is None:
        raise EventSuggestionNotFoundError

    from app.services.inbox_notification_service import notify_board_of_suggestion

    notify_board_of_suggestion(
        db,
        suggestion_id=loaded.id,
        title=loaded.title,
        suggested_by=member,
    )
    return loaded


def mark_event_suggestion_noted(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
) -> EventSuggestion:
    suggestion = _load_suggestion(db, suggestion_id)
    if suggestion is None:
        raise EventSuggestionNotFoundError

    if suggestion.status != EventSuggestionStatus.NOTED:
        suggestion.status = EventSuggestionStatus.NOTED
        suggestion.noted_at = datetime.now(UTC)
        suggestion.noted_by_id = board_member.id
        db.commit()
        db.refresh(suggestion)

    loaded = _load_suggestion(db, suggestion.id)
    if loaded is None:
        raise EventSuggestionNotFoundError

    if loaded.suggested_by_id is not None:
        from app.services.inbox_notification_service import notify_suggestion_noted

        notify_suggestion_noted(
            db,
            suggestion_id=loaded.id,
            suggested_by_id=loaded.suggested_by_id,
            title=loaded.title,
        )
    return loaded
