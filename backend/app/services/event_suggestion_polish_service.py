from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.event_suggestion_comment import (
    EventSuggestionComment,
    EventSuggestionCommentChannel,
)
from app.models.event_suggestion_interest import EventSuggestionInterest
from app.models.event_suggestion_poll import (
    EventSuggestionPoll,
    EventSuggestionPollOption,
    EventSuggestionPollVote,
)
from app.models.event_suggestion_view import EventSuggestionView
from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.event_suggestion import (
    EventSuggestionActivityItem,
    EventSuggestionMemberResponse,
    EventSuggestionPollCreateRequest,
    EventSuggestionPollOptionResponse,
    EventSuggestionPollResponse,
    EventSuggestionRelatedItem,
    IdeaFeedbackPackageRequest,
)
from app.services.event_suggestion_service import (
    get_event_suggestion,
    get_interest_counts_by_suggestion,
    member_can_view_suggestion,
)


class EventSuggestionPollError(Exception):
    pass


def record_event_suggestion_view(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
) -> EventSuggestion:
    suggestion = get_event_suggestion(
        db, suggestion_id=suggestion_id, member=member
    )
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
    return get_event_suggestion(db, suggestion_id=suggestion_id, member=member)


def list_related_event_suggestions(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
    limit: int = 4,
) -> list[EventSuggestionRelatedItem]:
    suggestion = get_event_suggestion(
        db, suggestion_id=suggestion_id, member=member
    )
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
    rows = [
        row for row in rows if member_can_view_suggestion(member, row)
    ][:limit]
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
    member: Member,
    limit: int = 30,
) -> list[EventSuggestionActivityItem]:
    """Milestone timeline only — not a chat log.

    Discussion messages, votes, and board notes stay in their own surfaces.
    Activity answers: what happened to this idea?
    """
    suggestion = get_event_suggestion(
        db, suggestion_id=suggestion_id, member=member
    )
    items: list[EventSuggestionActivityItem] = [
        EventSuggestionActivityItem(
            kind="created",
            summary="Idea submitted",
            created_at=suggestion.created_at,
            actor=EventSuggestionMemberResponse.model_validate(
                suggestion.suggested_by
            ),
        )
    ]

    noted_actor = (
        EventSuggestionMemberResponse.model_validate(suggestion.noted_by)
        if suggestion.noted_by is not None
        else None
    )

    # Internal review start (only while still in that stage — later transitions
    # overwrite noted_at, and we do not yet store a full status history).
    if (
        suggestion.status == EventSuggestionStatus.INTERNAL_REVIEW
        and suggestion.noted_at is not None
    ):
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary="Internal review started",
                created_at=suggestion.noted_at,
                actor=noted_actor,
            )
        )

    if suggestion.published_at is not None:
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary="Community feedback opened",
                created_at=suggestion.published_at,
                actor=noted_actor,
            )
        )

    if suggestion.community_feedback_closed_at is not None:
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary="Community feedback closed",
                created_at=suggestion.community_feedback_closed_at,
                actor=noted_actor,
            )
        )

    polls = db.scalars(
        select(EventSuggestionPoll)
        .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        .options(joinedload(EventSuggestionPoll.created_by))
        .order_by(EventSuggestionPoll.created_at.asc())
    ).all()
    if polls:
        # One milestone for the batch — not a row per poll.
        first = polls[0]
        count = len(polls)
        items.append(
            EventSuggestionActivityItem(
                kind="poll",
                summary=(
                    "1 poll created" if count == 1 else f"{count} polls created"
                ),
                created_at=first.created_at,
                actor=EventSuggestionMemberResponse.model_validate(
                    first.created_by
                ),
            )
        )

    if (
        suggestion.status == EventSuggestionStatus.APPROVED
        and suggestion.noted_at is not None
    ):
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary="Approved",
                created_at=suggestion.noted_at,
                actor=noted_actor,
            )
        )
    elif (
        suggestion.status == EventSuggestionStatus.REJECTED
        and suggestion.noted_at is not None
    ):
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary="Idea rejected",
                created_at=suggestion.noted_at,
                actor=noted_actor,
            )
        )
    elif (
        suggestion.status == EventSuggestionStatus.ARCHIVED
        and suggestion.noted_at is not None
    ):
        items.append(
            EventSuggestionActivityItem(
                kind="status",
                summary="Idea archived",
                created_at=suggestion.noted_at,
                actor=noted_actor,
            )
        )

    if (
        suggestion.status == EventSuggestionStatus.CONVERTED
        and suggestion.converted_event_id is not None
        and suggestion.noted_at is not None
    ):
        items.append(
            EventSuggestionActivityItem(
                kind="converted",
                summary="Converted to event",
                created_at=suggestion.noted_at,
                actor=noted_actor,
            )
        )

    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:limit]


def get_suggestion_engagement_stats(
    db: Session,
    *,
    suggestion_id: int,
    include_board: bool,
) -> dict[str, int | datetime | None]:
    """Counts for the Summary card — not Activity noise."""
    community_count = int(
        db.scalar(
            select(func.count())
            .select_from(EventSuggestionComment)
            .where(
                EventSuggestionComment.suggestion_id == suggestion_id,
                EventSuggestionComment.channel
                == EventSuggestionCommentChannel.COMMUNITY,
                EventSuggestionComment.deleted_at.is_(None),
            )
        )
        or 0
    )
    board_count = 0
    if include_board:
        board_count = int(
            db.scalar(
                select(func.count())
                .select_from(EventSuggestionComment)
                .where(
                    EventSuggestionComment.suggestion_id == suggestion_id,
                    EventSuggestionComment.channel
                    == EventSuggestionCommentChannel.BOARD,
                    EventSuggestionComment.deleted_at.is_(None),
                )
            )
            or 0
        )
    poll_count = int(
        db.scalar(
            select(func.count())
            .select_from(EventSuggestionPoll)
            .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        )
        or 0
    )
    open_poll_count = int(
        db.scalar(
            select(func.count())
            .select_from(EventSuggestionPoll)
            .where(
                EventSuggestionPoll.suggestion_id == suggestion_id,
                EventSuggestionPoll.is_open.is_(True),
            )
        )
        or 0
    )
    poll_vote_count = int(
        db.scalar(
            select(func.count())
            .select_from(EventSuggestionPollVote)
            .join(
                EventSuggestionPoll,
                EventSuggestionPollVote.poll_id == EventSuggestionPoll.id,
            )
            .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        )
        or 0
    )

    last_comment_at = db.scalar(
        select(func.max(EventSuggestionComment.created_at)).where(
            EventSuggestionComment.suggestion_id == suggestion_id,
            EventSuggestionComment.deleted_at.is_(None),
            *(
                ()
                if include_board
                else (
                    EventSuggestionComment.channel
                    == EventSuggestionCommentChannel.COMMUNITY,
                )
            ),
        )
    )
    last_interest_at = db.scalar(
        select(func.max(EventSuggestionInterest.updated_at)).where(
            EventSuggestionInterest.suggestion_id == suggestion_id
        )
    )
    last_poll_at = db.scalar(
        select(func.max(EventSuggestionPoll.created_at)).where(
            EventSuggestionPoll.suggestion_id == suggestion_id
        )
    )

    candidates = [
        value
        for value in (last_comment_at, last_interest_at, last_poll_at)
        if value is not None
    ]
    last_activity_at = max(candidates) if candidates else None

    eligible_member_count = int(
        db.scalar(
            select(func.count())
            .select_from(Member)
            .where(Member.status == MemberStatus.APPROVED)
        )
        or 0
    )

    return {
        "board_comment_count": board_count,
        "community_comment_count": community_count,
        "poll_count": poll_count,
        "open_poll_count": open_poll_count,
        "poll_vote_count": poll_vote_count,
        "eligible_member_count": eligible_member_count,
        "last_activity_at": last_activity_at,
    }


FEEDBACK_PACKAGE_POLLS: dict[str, tuple[str, list[str]]] = {
    "preferred_semester": (
        "Preferred semester?",
        ["Fall", "Spring", "Summer"],
    ),
    "transportation": (
        "Transportation",
        ["Bus", "Own car", "Other"],
    ),
    "budget": (
        "Comfortable contribution?",
        ["Free", "$10", "$15", "$20"],
    ),
    "volunteer_interest": (
        "Would you volunteer to help?",
        ["Yes", "Maybe", "No"],
    ),
}


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


def _load_poll(
    db: Session,
    *,
    suggestion_id: int,
    poll_id: int | None = None,
) -> EventSuggestionPoll | None:
    query = (
        select(EventSuggestionPoll)
        .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        .options(
            joinedload(EventSuggestionPoll.created_by),
            selectinload(EventSuggestionPoll.options),
            selectinload(EventSuggestionPoll.votes),
        )
        .order_by(EventSuggestionPoll.created_at.asc())
    )
    if poll_id is not None:
        query = query.where(EventSuggestionPoll.id == poll_id)
    return db.scalar(query)


def list_event_suggestion_polls(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
) -> list[EventSuggestionPollResponse]:
    get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
    polls = db.scalars(
        select(EventSuggestionPoll)
        .where(EventSuggestionPoll.suggestion_id == suggestion_id)
        .options(
            joinedload(EventSuggestionPoll.created_by),
            selectinload(EventSuggestionPoll.options),
            selectinload(EventSuggestionPoll.votes),
        )
        .order_by(EventSuggestionPoll.created_at.asc())
    ).unique().all()
    return [_poll_to_response(poll, member=member) for poll in polls]


def get_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
    poll_id: int | None = None,
) -> EventSuggestionPollResponse | None:
    """Return one poll (by id) or the oldest poll for legacy callers."""
    get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
    poll = _load_poll(db, suggestion_id=suggestion_id, poll_id=poll_id)
    if poll is None:
        return None
    return _poll_to_response(poll, member=member)


def _create_poll_row(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    question: str,
    options: list[str],
    commit: bool = True,
) -> EventSuggestionPoll:
    cleaned_options = [option.strip() for option in options if option.strip()]
    if len(cleaned_options) < 2 or len(cleaned_options) > 6:
        raise EventSuggestionPollError
    question_clean = question.strip()
    if not question_clean:
        raise EventSuggestionPollError

    now = datetime.now(UTC)
    poll = EventSuggestionPoll(
        suggestion_id=suggestion_id,
        question=question_clean[:255],
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
    if commit:
        db.commit()
    return poll


def create_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    data: EventSuggestionPollCreateRequest,
) -> EventSuggestionPollResponse:
    if not board_member.has_role_at_least(MemberRole.BOARD):
        raise EventSuggestionPollError
    suggestion = get_event_suggestion(
        db, suggestion_id=suggestion_id, member=board_member
    )
    if suggestion.status != EventSuggestionStatus.PUBLISHED:
        raise EventSuggestionPollError

    poll = _create_poll_row(
        db,
        suggestion_id=suggestion_id,
        board_member=board_member,
        question=data.question,
        options=data.options,
    )
    loaded = get_event_suggestion_poll(
        db,
        suggestion_id=suggestion_id,
        member=board_member,
        poll_id=poll.id,
    )
    if loaded is None:
        raise EventSuggestionPollError
    return loaded


def apply_idea_feedback_package(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    package: IdeaFeedbackPackageRequest,
    commit: bool = True,
) -> list[EventSuggestionPollResponse]:
    """Create preset polls for a published idea. Attendance is always available."""
    if not board_member.has_role_at_least(MemberRole.BOARD):
        raise EventSuggestionPollError
    suggestion = get_event_suggestion(
        db, suggestion_id=suggestion_id, member=board_member
    )
    if suggestion.status != EventSuggestionStatus.PUBLISHED:
        raise EventSuggestionPollError

    existing_questions = {
        row.question.strip().lower()
        for row in db.scalars(
            select(EventSuggestionPoll).where(
                EventSuggestionPoll.suggestion_id == suggestion_id
            )
        ).all()
    }

    created_ids: list[int] = []
    for key, (question, options) in FEEDBACK_PACKAGE_POLLS.items():
        if not getattr(package, key, False):
            continue
        if question.strip().lower() in existing_questions:
            continue
        poll = _create_poll_row(
            db,
            suggestion_id=suggestion_id,
            board_member=board_member,
            question=question,
            options=options,
            commit=False,
        )
        created_ids.append(poll.id)
        existing_questions.add(question.strip().lower())

    suggestion.community_interest_enabled = bool(package.attendance_interest)
    suggestion.community_discussion_enabled = bool(package.discussion)
    db.add(suggestion)

    if commit:
        db.commit()
    else:
        db.flush()

    return [
        poll
        for poll_id in created_ids
        if (
            poll := get_event_suggestion_poll(
                db,
                suggestion_id=suggestion_id,
                member=board_member,
                poll_id=poll_id,
            )
        )
        is not None
    ]


def vote_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
    option_id: int,
    poll_id: int | None = None,
) -> EventSuggestionPollResponse:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
    if getattr(suggestion, "community_feedback_closed_at", None) is not None:
        raise EventSuggestionPollError
    poll = _load_poll(db, suggestion_id=suggestion_id, poll_id=poll_id)
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
        poll_id=poll.id,
    )
    if loaded is None:
        raise EventSuggestionPollError
    return loaded


def close_event_suggestion_poll(
    db: Session,
    *,
    suggestion_id: int,
    board_member: Member,
    poll_id: int | None = None,
) -> EventSuggestionPollResponse:
    if not board_member.has_role_at_least(MemberRole.BOARD):
        raise EventSuggestionPollError
    get_event_suggestion(db, suggestion_id=suggestion_id, member=board_member)
    poll = _load_poll(db, suggestion_id=suggestion_id, poll_id=poll_id)
    if poll is None:
        raise EventSuggestionPollError
    poll.is_open = False
    db.commit()
    loaded = get_event_suggestion_poll(
        db,
        suggestion_id=suggestion_id,
        member=board_member,
        poll_id=poll.id,
    )
    if loaded is None:
        raise EventSuggestionPollError
    return loaded
