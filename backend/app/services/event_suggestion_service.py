from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.lib.event_photo_archive import default_show_in_photo_archive
from app.models.event import Event, EventType
from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.event_suggestion_interest import (
    EventSuggestionInterest,
    EventSuggestionInterestVote,
)
from app.models.member import Member, MemberRole
from app.schemas.event_suggestion import (
    EventSuggestionConvertRequest,
    EventSuggestionCreateRequest,
    EventSuggestionInterestCounts,
    IdeaFeedbackPackageRequest,
)
from app.services.organization_context import get_default_organization_id

BOARD_UPDATABLE_STATUSES = frozenset(
    {
        EventSuggestionStatus.INTERNAL_REVIEW,
        EventSuggestionStatus.PUBLISHED,
        EventSuggestionStatus.APPROVED,
        EventSuggestionStatus.REJECTED,
        EventSuggestionStatus.ARCHIVED,
    }
)

# Community RSVP / public discussion while the idea is live for feedback.
COMMUNITY_FEEDBACK_OPEN_STATUSES = frozenset(
    {
        EventSuggestionStatus.PUBLISHED,
    }
)

INTEREST_OPEN_STATUSES = COMMUNITY_FEEDBACK_OPEN_STATUSES

# Always visible once the board has shared the idea with members.
_POST_PUBLISH_VISIBLE = frozenset(
    {
        EventSuggestionStatus.PUBLISHED,
        EventSuggestionStatus.APPROVED,
        EventSuggestionStatus.CONVERTED,
        EventSuggestionStatus.REJECTED,
        EventSuggestionStatus.ARCHIVED,
    }
)

ALLOWED_TRANSITIONS: dict[EventSuggestionStatus, frozenset[EventSuggestionStatus]] = {
    EventSuggestionStatus.SUBMITTED: frozenset(
        {
            EventSuggestionStatus.INTERNAL_REVIEW,
            EventSuggestionStatus.REJECTED,
        }
    ),
    EventSuggestionStatus.INTERNAL_REVIEW: frozenset(
        {
            EventSuggestionStatus.PUBLISHED,
            EventSuggestionStatus.REJECTED,
            EventSuggestionStatus.ARCHIVED,
        }
    ),
    EventSuggestionStatus.PUBLISHED: frozenset(
        {
            EventSuggestionStatus.APPROVED,
            EventSuggestionStatus.REJECTED,
            EventSuggestionStatus.ARCHIVED,
            EventSuggestionStatus.INTERNAL_REVIEW,
        }
    ),
    EventSuggestionStatus.APPROVED: frozenset(
        {
            EventSuggestionStatus.ARCHIVED,
            EventSuggestionStatus.REJECTED,
            EventSuggestionStatus.PUBLISHED,
        }
    ),
    EventSuggestionStatus.REJECTED: frozenset(
        {
            EventSuggestionStatus.APPROVED,
            EventSuggestionStatus.INTERNAL_REVIEW,
            EventSuggestionStatus.ARCHIVED,
        }
    ),
    EventSuggestionStatus.ARCHIVED: frozenset(
        {
            EventSuggestionStatus.INTERNAL_REVIEW,
            EventSuggestionStatus.PUBLISHED,
        }
    ),
    EventSuggestionStatus.CONVERTED: frozenset(
        {
            EventSuggestionStatus.ARCHIVED,
        }
    ),
}


class EventSuggestionNotFoundError(Exception):
    pass


class EventSuggestionInvalidStatusError(Exception):
    pass


class EventSuggestionInterestClosedError(Exception):
    pass


class EventSuggestionReviewEmptyError(Exception):
    pass


class EventSuggestionNotConvertibleError(Exception):
    pass


def member_can_view_suggestion(member: Member, suggestion: EventSuggestion) -> bool:
    if member.has_role_at_least(MemberRole.BOARD):
        return True
    if suggestion.suggested_by_id == member.id:
        return True

    visibility = getattr(suggestion, "community_visibility", "members") or "members"
    if visibility == "officers":
        return False

    if suggestion.status in {
        EventSuggestionStatus.PUBLISHED,
        EventSuggestionStatus.APPROVED,
        EventSuggestionStatus.CONVERTED,
    }:
        # everyone / members / active_members currently map to approved members.
        # officers is handled above. Active-semester filtering can tighten later.
        return True
    if (
        suggestion.published_at is not None
        and suggestion.status in _POST_PUBLISH_VISIBLE
    ):
        return True
    return False


def _load_suggestion(db: Session, suggestion_id: int) -> EventSuggestion | None:
    return db.scalar(
        select(EventSuggestion)
        .where(EventSuggestion.id == suggestion_id)
        .options(
            joinedload(EventSuggestion.suggested_by),
            joinedload(EventSuggestion.noted_by),
            joinedload(EventSuggestion.board_note_updated_by),
        ),
    )


def list_event_suggestions(db: Session, *, member: Member) -> list[EventSuggestion]:
    org_id = get_default_organization_id(db)
    query = (
        select(EventSuggestion)
        .options(
            joinedload(EventSuggestion.suggested_by),
            joinedload(EventSuggestion.noted_by),
            joinedload(EventSuggestion.board_note_updated_by),
        )
        .where(EventSuggestion.organization_id == org_id)
        .order_by(EventSuggestion.created_at.desc())
    )

    if not member.has_role_at_least(MemberRole.BOARD):
        query = query.where(
            or_(
                EventSuggestion.suggested_by_id == member.id,
                EventSuggestion.status.in_(
                    [
                        EventSuggestionStatus.PUBLISHED,
                        EventSuggestionStatus.APPROVED,
                        EventSuggestionStatus.CONVERTED,
                    ]
                ),
                EventSuggestion.published_at.is_not(None),
            )
        )

    rows = list(db.scalars(query).all())
    if member.has_role_at_least(MemberRole.BOARD):
        return rows
    return [
        row
        for row in rows
        if row.suggested_by_id == member.id
        or (getattr(row, "community_visibility", "members") or "members")
        != "officers"
    ]


def get_event_suggestion(
    db: Session,
    *,
    suggestion_id: int,
    member: Member | None = None,
) -> EventSuggestion:
    suggestion = _load_suggestion(db, suggestion_id)
    if suggestion is None:
        raise EventSuggestionNotFoundError
    if suggestion.organization_id != get_default_organization_id(db):
        raise EventSuggestionNotFoundError
    if member is not None and not member_can_view_suggestion(member, suggestion):
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
        status=EventSuggestionStatus.SUBMITTED,
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


def _assert_transition_allowed(
    current: EventSuggestionStatus,
    target: EventSuggestionStatus,
) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise EventSuggestionInvalidStatusError


def _apply_status_side_effects(
    suggestion: EventSuggestion,
    *,
    previous: EventSuggestionStatus,
    board_member: Member,
    now: datetime,
) -> None:
    suggestion.noted_at = now
    suggestion.noted_by_id = board_member.id
    if (
        suggestion.status == EventSuggestionStatus.PUBLISHED
        and suggestion.published_at is None
    ):
        suggestion.published_at = now
        suggestion.community_feedback_closed_at = None
    # Keep published_at if returning to internal_review after a prior publish.
    _ = previous


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
        _assert_transition_allowed(previous_status, status)
        now = datetime.now(UTC)
        suggestion.status = status
        _apply_status_side_effects(
            suggestion,
            previous=previous_status,
            board_member=board_member,
            now=now,
        )
        db.commit()
        db.refresh(suggestion)

    loaded = _load_suggestion(db, suggestion.id)
    if loaded is None:
        raise EventSuggestionNotFoundError

    if (
        previous_status == EventSuggestionStatus.SUBMITTED
        and loaded.status == EventSuggestionStatus.INTERNAL_REVIEW
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
    """Board starts private internal review."""
    return update_event_suggestion_status(
        db,
        suggestion_id=suggestion_id,
        board_member=board_member,
        status=EventSuggestionStatus.INTERNAL_REVIEW,
    )


def apply_event_suggestion_board_review(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    status: EventSuggestionStatus | None = None,
    board_note: str | None = None,
    update_board_note: bool = False,
    feedback_package: IdeaFeedbackPackageRequest | None = None,
    community_visibility: str | None = None,
    community_feedback_closed: bool | None = None,
) -> EventSuggestion:
    """Apply board review: optional status change and/or internal note."""
    if (
        status is None
        and not update_board_note
        and feedback_package is None
        and community_visibility is None
        and community_feedback_closed is None
    ):
        raise EventSuggestionReviewEmptyError

    if status is not None and status not in BOARD_UPDATABLE_STATUSES:
        raise EventSuggestionInvalidStatusError

    suggestion = _load_suggestion(db, suggestion_id)
    if suggestion is None:
        raise EventSuggestionNotFoundError
    if suggestion.organization_id != get_default_organization_id(db):
        raise EventSuggestionNotFoundError

    previous_status = suggestion.status
    now = datetime.now(UTC)
    changed = False

    if status is not None and suggestion.status != status:
        _assert_transition_allowed(previous_status, status)
        suggestion.status = status
        _apply_status_side_effects(
            suggestion,
            previous=previous_status,
            board_member=board_member,
            now=now,
        )
        changed = True

    if update_board_note:
        cleaned = board_note.strip() if board_note else ""
        suggestion.board_note = cleaned or None
        suggestion.board_note_updated_at = now
        suggestion.board_note_updated_by_id = board_member.id
        changed = True

    if community_visibility is not None:
        suggestion.community_visibility = community_visibility
        changed = True

    if community_feedback_closed is not None:
        if suggestion.status != EventSuggestionStatus.PUBLISHED:
            raise EventSuggestionInvalidStatusError
        if community_feedback_closed:
            suggestion.community_feedback_closed_at = now
            suggestion.noted_at = now
            suggestion.noted_by_id = board_member.id
            # Lock open polls when feedback closes.
            from app.models.event_suggestion_poll import EventSuggestionPoll

            for poll in db.scalars(
                select(EventSuggestionPoll).where(
                    EventSuggestionPoll.suggestion_id == suggestion_id,
                    EventSuggestionPoll.is_open.is_(True),
                )
            ).all():
                poll.is_open = False
        else:
            suggestion.community_feedback_closed_at = None
        changed = True

    if changed:
        db.commit()
        db.refresh(suggestion)

    loaded = _load_suggestion(db, suggestion.id)
    if loaded is None:
        raise EventSuggestionNotFoundError

    if (
        previous_status == EventSuggestionStatus.SUBMITTED
        and loaded.status == EventSuggestionStatus.INTERNAL_REVIEW
        and loaded.suggested_by_id is not None
    ):
        from app.services.inbox_notification_service import notify_suggestion_noted

        notify_suggestion_noted(
            db,
            suggestion_id=loaded.id,
            suggested_by_id=loaded.suggested_by_id,
            title=loaded.title,
        )

    just_published = (
        loaded.status == EventSuggestionStatus.PUBLISHED
        and (
            previous_status != EventSuggestionStatus.PUBLISHED
            or feedback_package is not None
        )
    )
    if feedback_package is not None and just_published:
        from app.services.event_suggestion_polish_service import (
            EventSuggestionPollError,
            apply_idea_feedback_package,
        )

        try:
            apply_idea_feedback_package(
                db,
                suggestion_id=loaded.id,
                board_member=board_member,
                package=feedback_package,
            )
        except EventSuggestionPollError as exc:
            raise EventSuggestionInvalidStatusError from exc
        # Package apply commits separately — reload so response flags are fresh.
        loaded = _load_suggestion(db, loaded.id)
        if loaded is None:
            raise EventSuggestionNotFoundError

    return loaded


def convert_event_suggestion_to_event(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    data: EventSuggestionConvertRequest,
) -> EventSuggestion:
    suggestion = _load_suggestion(db, suggestion_id)
    if suggestion is None:
        raise EventSuggestionNotFoundError
    if suggestion.organization_id != get_default_organization_id(db):
        raise EventSuggestionNotFoundError

    if (
        suggestion.status != EventSuggestionStatus.APPROVED
        or suggestion.converted_event_id is not None
    ):
        raise EventSuggestionNotConvertibleError

    name = (data.name or suggestion.title).strip()
    description = (data.description or suggestion.description).strip()
    if not name or not description:
        raise EventSuggestionNotConvertibleError

    now = datetime.now(UTC)
    event = Event(
        title=name,
        description=description,
        event_type=data.event_type,
        starts_at=data.starts_at,
        location=data.location,
        capacity=data.capacity,
        budget=data.budget,
        show_in_photo_archive=default_show_in_photo_archive(data.event_type),
        meeting_visibility=(
            data.meeting_visibility if data.event_type == EventType.MEETING else None
        ),
        created_by_id=board_member.id,
        organization_id=get_default_organization_id(db),
    )
    db.add(event)
    db.flush()

    suggestion.status = EventSuggestionStatus.CONVERTED
    suggestion.converted_event_id = event.id
    suggestion.noted_at = now
    suggestion.noted_by_id = board_member.id
    db.commit()
    db.refresh(suggestion)

    loaded = _load_suggestion(db, suggestion.id)
    if loaded is None:
        raise EventSuggestionNotFoundError
    return loaded


def empty_interest_counts() -> EventSuggestionInterestCounts:
    return EventSuggestionInterestCounts()


def get_interest_counts_by_suggestion(
    db: Session,
    *,
    suggestion_ids: list[int],
) -> dict[int, EventSuggestionInterestCounts]:
    if not suggestion_ids:
        return {}

    rows = db.execute(
        select(
            EventSuggestionInterest.suggestion_id,
            EventSuggestionInterest.vote,
            func.count(),
        )
        .where(EventSuggestionInterest.suggestion_id.in_(suggestion_ids))
        .group_by(
            EventSuggestionInterest.suggestion_id,
            EventSuggestionInterest.vote,
        )
    ).all()

    counts: dict[int, dict[str, int]] = defaultdict(
        lambda: {"interested": 0, "maybe": 0, "not_interested": 0}
    )
    for suggestion_id, vote, total in rows:
        vote_key = vote.value if hasattr(vote, "value") else str(vote)
        counts[suggestion_id][vote_key] = int(total)

    return {
        suggestion_id: EventSuggestionInterestCounts(**values)
        for suggestion_id, values in counts.items()
    }


def get_my_interest_by_suggestion(
    db: Session,
    *,
    suggestion_ids: list[int],
    member_id: int,
) -> dict[int, EventSuggestionInterestVote]:
    if not suggestion_ids:
        return {}

    rows = db.scalars(
        select(EventSuggestionInterest).where(
            EventSuggestionInterest.suggestion_id.in_(suggestion_ids),
            EventSuggestionInterest.member_id == member_id,
        )
    ).all()
    return {row.suggestion_id: row.vote for row in rows}


def set_event_suggestion_interest(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
    vote: EventSuggestionInterestVote,
) -> EventSuggestion:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
    if suggestion.status not in INTEREST_OPEN_STATUSES:
        raise EventSuggestionInterestClosedError
    if not bool(getattr(suggestion, "community_interest_enabled", True)):
        raise EventSuggestionInterestClosedError
    if getattr(suggestion, "community_feedback_closed_at", None) is not None:
        raise EventSuggestionInterestClosedError

    now = datetime.now(UTC)
    existing = db.scalar(
        select(EventSuggestionInterest).where(
            EventSuggestionInterest.suggestion_id == suggestion_id,
            EventSuggestionInterest.member_id == member.id,
        )
    )
    if existing is None:
        db.add(
            EventSuggestionInterest(
                suggestion_id=suggestion_id,
                member_id=member.id,
                vote=vote,
                created_at=now,
                updated_at=now,
            )
        )
    else:
        existing.vote = vote
        existing.updated_at = now

    db.commit()
    return get_event_suggestion(db, suggestion_id=suggestion_id, member=member)


def clear_event_suggestion_interest(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
) -> EventSuggestion:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
    if suggestion.status not in INTEREST_OPEN_STATUSES:
        raise EventSuggestionInterestClosedError
    if not bool(getattr(suggestion, "community_interest_enabled", True)):
        raise EventSuggestionInterestClosedError
    if getattr(suggestion, "community_feedback_closed_at", None) is not None:
        raise EventSuggestionInterestClosedError

    existing = db.scalar(
        select(EventSuggestionInterest).where(
            EventSuggestionInterest.suggestion_id == suggestion_id,
            EventSuggestionInterest.member_id == member.id,
        )
    )
    if existing is not None:
        db.delete(existing)
        db.commit()

    return get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
