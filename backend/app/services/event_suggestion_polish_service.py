from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.event_suggestion_comment import EventSuggestionComment
from app.models.event_suggestion_interest import EventSuggestionInterest
from app.models.event_suggestion_poll import (
    EventSuggestionPoll,
    EventSuggestionPollOption,
    EventSuggestionPollVote,
)
from app.models.event_suggestion_view import EventSuggestionView
from app.models.member import Member, MemberRole
from app.schemas.event_suggestion import (
    EventSuggestionActivityItem,
    EventSuggestionMemberResponse,
    EventSuggestionPollCreateRequest,
    EventSuggestionPollOptionResponse,
    EventSuggestionPollResponse,
    EventSuggestionRelatedItem,
)
from app.services.event_suggestion_service import (
    EventSuggestionNotFoundError,
    get_event_suggestion,
    get_interest_counts_by_suggestion,
)


class EventSuggestionPollError(Exception):
    pass


def record_event_suggestion_view(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
) -> EventSuggestion:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id)
    existing = db.scalar(
        select(EventSuggestionView).where(
            EventSuggestionView.suggestion_id == suggestion_id,
            EventSuggestionView.member_id == member.id,
        )
    )
    if existing is None:
        db.add(
            EventSuggestionView(
                suggestion_id=suggestion_id,
                member_id=member.id,
                viewed_at=datetime.now(UTC),
            )
        )
        suggestion.view_count = int(suggestion.view_count or 0) + 1
        db.commit()
        db.refresh(suggestion)
    return get_event_suggestion(db, suggestion_id=suggestion_id)


def list_related_event_suggestions(
    db: Session,
    *,
    suggestion_id: int,
    limit: int = 4,
) -> list[EventSuggestionRelatedItem]:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id)
    timing = (suggestion.preferred_timing or "").strip()
    title_token = suggestion.title.strip().split(" ")[0] if suggestion.title else ""

    filters = [
        EventSuggestion.id != suggestion_id,
        EventSuggestion.organization_id == suggestion.organization_id,
        EventSuggestion.status.not_in(
            [
                EventSuggestionStatus.REJECTED,
                EventSuggestionStatus.ARCHIVED,
            ]
        ),
    ]
    match_filters = []
    if timing:
        match_filters.append(EventSuggestion.preferred_timing == timing)
    if len(title_token) >= 3:
        match_filters.append(EventSuggestion.title.ilike(f"%{title_token}%"))
    if match_filters:
        filters.append(or_(*match_filters))

    rows = list(
        db.scalars(
            select(EventSuggestion)
            .options(joinedload(EventSuggestion.suggested_by))
            .where(*filters)
            .order_by(EventSuggestion.created_at.desc())
            .limit(limit * 3)
        )
        .unique()
        .all()
    )
    # Prefer same timing first.
    rows.sort(
        key=lambda row: (
            0
            if timing and (row.preferred_timing or "").strip() == timing
            else 1,
            -row.created_at.timestamp(),
        )
    )
    rows = rows[:limit]
    counts = get_interest_counts_by_suggestion(
        db,
        suggestion_ids=[row.id for row in rows],
    )
    return [
        EventSuggestionRelatedItem(
            id=row.id,
            title=row.title,
            status=row.status.value,
            preferred_timing=row.preferred_timing,
            interested_count=counts.get(row.id).interested if counts.get(row.id) else 0,
            suggested_by=EventSuggestionMemberResponse.model_validate(
                row.suggested_by
            ),
        )
        for row in rows
    ]


def build_event_suggestion_activity(
    db: Session,
    *,
    suggestion_id: int,
    limit: int = 30,
) -> list[EventSuggestionActivityItem]:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id)
    items: list[EventSuggestionActivityItem] = [
        EventSuggestionActivityItem(
            kind="created",
            summary=f"{suggestion.suggested_by.full_name} submitted this idea",
            created_at=suggestion.created_at,
            actor=EventSuggestionMemberResponse.model_validate(
                suggestion.suggested_by
            ),
        )
    ]

    interests = db.scalars(
        select(EventSuggestionInterest)
        .where(EventSuggestionInterest.suggestion_id == suggestion_id)
        .options(joinedload(EventSuggestionInterest.member))
        .order_by(EventSuggestionInterest.updated_at.desc())
        .limit(limit)
    ).all()
    for row in interests:
        label = row.vote.value.replace("_", " ")
        items.append(
            EventSuggestionActivityItem(
                kind="interest",
                summary=f"{row.member.full_name} marked {label}",
                created_at=row.updated_at or row.created_at,
                actor=EventSuggestionMemberResponse.model_validate(row.member),
            )
        )

    comments = db.scalars(
        select(EventSuggestionComment)
        .where(EventSuggestionComment.suggestion_id == suggestion_id)
        .where(EventSuggestionComment.deleted_at.is_(None))
        .options(joinedload(EventSuggestionComment.author))
        .order_by(EventSuggestionComment.created_at.desc())
        .limit(limit)
    ).all()
    for row in comments:
        kind = "reply" if row.parent_id is not None else "comment"
        verb = "replied" if kind == "reply" else "commented"
        items.append(
            EventSuggestionActivityItem(
                kind=kind,
                summary=f"{row.author.full_name} {verb}",
                created_at=row.created_at,
                actor=EventSuggestionMemberResponse.model_validate(row.author),
            )
        )

    if suggestion.noted_at is not None and suggestion.noted_by is not None:
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary=(
                    f"{suggestion.noted_by.full_name} set status to "
                    f"{suggestion.status.value.replace('_', ' ')}"
                ),
                created_at=suggestion.noted_at,
                actor=EventSuggestionMemberResponse.model_validate(
                    suggestion.noted_by
                ),
            )
        )

    if (
        suggestion.status == EventSuggestionStatus.CONVERTED
        and suggestion.converted_event_id is not None
        and suggestion.noted_at is not None
    ):
        actor = (
            EventSuggestionMemberResponse.model_validate(suggestion.noted_by)
            if suggestion.noted_by is not None
            else None
        )
        items.append(
            EventSuggestionActivityItem(
                kind="converted",
                summary="Converted to a calendar event",
                created_at=suggestion.noted_at,
                actor=actor,
            )
        )

    poll = db.scalar(
        select(EventSuggestionPoll)
        .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        .options(joinedload(EventSuggestionPoll.created_by))
    )
    if poll is not None:
        items.append(
            EventSuggestionActivityItem(
                kind="poll",
                summary=f"{poll.created_by.full_name} opened a poll",
                created_at=poll.created_at,
                actor=EventSuggestionMemberResponse.model_validate(poll.created_by),
            )
        )

    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:limit]


def _poll_to_response(
    poll: EventSuggestionPoll,
    *,
    member: Member,
) -> EventSuggestionPollResponse:
    vote_counts: dict[int, int] = {}
    for vote in poll.votes:
        vote_counts[vote.option_id] = vote_counts.get(vote.option_id, 0) + 1
    my_vote = next(
        (vote.option_id for vote in poll.votes if vote.member_id == member.id),
        None,
    )
    return EventSuggestionPollResponse(
        id=poll.id,
        suggestion_id=poll.suggestion_id,
        question=poll.question,
        is_open=poll.is_open,
        created_at=poll.created_at,
        created_by=EventSuggestionMemberResponse.model_validate(poll.created_by),
        my_option_id=my_vote,
        total_votes=len(poll.votes),
        options=[
            EventSuggestionPollOptionResponse(
                id=option.id,
                label=option.label,
                sort_order=option.sort_order,
                vote_count=vote_counts.get(option.id, 0),
            )
            for option in sorted(poll.options, key=lambda row: row.sort_order)
        ],
    )


def get_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
) -> EventSuggestionPollResponse | None:
    get_event_suggestion(db, suggestion_id=suggestion_id)
    poll = db.scalar(
        select(EventSuggestionPoll)
        .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        .options(
            joinedload(EventSuggestionPoll.created_by),
            selectinload(EventSuggestionPoll.options),
            selectinload(EventSuggestionPoll.votes),
        )
    )
    if poll is None:
        return None
    return _poll_to_response(poll, member=member)


def create_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    data: EventSuggestionPollCreateRequest,
) -> EventSuggestionPollResponse:
    if not board_member.has_role_at_least(MemberRole.BOARD):
        raise EventSuggestionPollError
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id)
    if suggestion.status in {
        EventSuggestionStatus.REJECTED,
        EventSuggestionStatus.ARCHIVED,
        EventSuggestionStatus.CONVERTED,
    }:
        raise EventSuggestionPollError

    existing = db.scalar(
        select(EventSuggestionPoll).where(
            EventSuggestionPoll.suggestion_id == suggestion_id
        )
    )
    if existing is not None:
        raise EventSuggestionPollError

    cleaned_options = [option.strip() for option in data.options if option.strip()]
    if len(cleaned_options) < 2 or len(cleaned_options) > 6:
        raise EventSuggestionPollError

    now = datetime.now(UTC)
    poll = EventSuggestionPoll(
        suggestion_id=suggestion_id,
        question=data.question.strip(),
        is_open=True,
        created_by_id=board_member.id,
        created_at=now,
    )
    db.add(poll)
    db.flush()
    for index, label in enumerate(cleaned_options):
        db.add(
            EventSuggestionPollOption(
                poll_id=poll.id,
                label=label[:120],
                sort_order=index,
            )
        )
    db.commit()

    loaded = get_event_suggestion_poll(
        db,
        suggestion_id=suggestion_id,
        member=board_member,
    )
    if loaded is None:
        raise EventSuggestionPollError
    return loaded


def vote_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
    option_id: int,
) -> EventSuggestionPollResponse:
    get_event_suggestion(db, suggestion_id=suggestion_id)
    poll = db.scalar(
        select(EventSuggestionPoll)
        .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        .options(
            joinedload(EventSuggestionPoll.created_by),
            selectinload(EventSuggestionPoll.options),
            selectinload(EventSuggestionPoll.votes),
        )
    )
    if poll is None or not poll.is_open:
        raise EventSuggestionPollError

    option_ids = {option.id for option in poll.options}
    if option_id not in option_ids:
        raise EventSuggestionPollError

    existing = next(
        (vote for vote in poll.votes if vote.member_id == member.id),
        None,
    )
    now = datetime.now(UTC)
    if existing is None:
        db.add(
            EventSuggestionPollVote(
                poll_id=poll.id,
                option_id=option_id,
                member_id=member.id,
                created_at=now,
            )
        )
    else:
        existing.option_id = option_id
    db.commit()

    loaded = get_event_suggestion_poll(
        db,
        suggestion_id=suggestion_id,
        member=member,
    )
    if loaded is None:
        raise EventSuggestionPollError
    return loaded


def close_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
) -> EventSuggestionPollResponse:
    if not board_member.has_role_at_least(MemberRole.BOARD):
        raise EventSuggestionPollError
    get_event_suggestion(db, suggestion_id=suggestion_id)
    poll = db.scalar(
        select(EventSuggestionPoll).where(
            EventSuggestionPoll.suggestion_id == suggestion_id
        )
    )
    if poll is None:
        raise EventSuggestionPollError
    poll.is_open = False
    db.commit()
    loaded = get_event_suggestion_poll(
        db,
        suggestion_id=suggestion_id,
        member=board_member,
    )
    if loaded is None:
        raise EventSuggestionPollError
    return loaded
