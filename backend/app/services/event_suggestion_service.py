from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.member import Member
from app.schemas.event_suggestion import EventSuggestionCreateRequest
from app.services.organization_context import get_default_organization_id

BOARD_UPDATABLE_STATUSES = frozenset(
    {
        EventSuggestionStatus.UNDER_DISCUSSION,
        EventSuggestionStatus.APPROVED,
        EventSuggestionStatus.REJECTED,
        EventSuggestionStatus.ARCHIVED,
    }
)


class EventSuggestionNotFoundError(Exception):
    pass


class EventSuggestionInvalidStatusError(Exception):
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
            .where(
                EventSuggestion.organization_id == get_default_organization_id(db)
            )
            .order_by(EventSuggestion.created_at.desc()),
        ).all(),
    )


def get_event_suggestion(db: Session, *, suggestion_id: int) -> EventSuggestion:
    suggestion = _load_suggestion(db, suggestion_id)
    if suggestion is None:
        raise EventSuggestionNotFoundError
    if suggestion.organization_id != get_default_organization_id(db):
        raise EventSuggestionNotFoundError
    return suggestion


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
        status=EventSuggestionStatus.PENDING_REVIEW,
        suggested_by_id=member.id,
        created_at=now,
        organization_id=get_default_organization_id(db),
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


def update_event_suggestion_status(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    status: EventSuggestionStatus,
) -> EventSuggestion:
    if status not in BOARD_UPDATABLE_STATUSES:
        raise EventSuggestionInvalidStatusError

    suggestion = _load_suggestion(db, suggestion_id)
    if suggestion is None:
        raise EventSuggestionNotFoundError
    if suggestion.organization_id != get_default_organization_id(db):
        raise EventSuggestionNotFoundError

    previous_status = suggestion.status
    if suggestion.status != status:
        suggestion.status = status
        if suggestion.noted_at is None:
            suggestion.noted_at = datetime.now(UTC)
            suggestion.noted_by_id = board_member.id
        db.commit()
        db.refresh(suggestion)

    loaded = _load_suggestion(db, suggestion.id)
    if loaded is None:
        raise EventSuggestionNotFoundError

    if (
        previous_status == EventSuggestionStatus.PENDING_REVIEW
        and loaded.status == EventSuggestionStatus.UNDER_DISCUSSION
        and loaded.suggested_by_id is not None
    ):
        from app.services.inbox_notification_service import notify_suggestion_noted

        notify_suggestion_noted(
            db,
            suggestion_id=loaded.id,
            suggested_by_id=loaded.suggested_by_id,
            title=loaded.title,
        )
    return loaded


def mark_event_suggestion_noted(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
) -> EventSuggestion:
    """Compatibility helper: board review opens discussion."""
    return update_event_suggestion_status(
        db,
        suggestion_id=suggestion_id,
        board_member=board_member,
        status=EventSuggestionStatus.UNDER_DISCUSSION,
    )
