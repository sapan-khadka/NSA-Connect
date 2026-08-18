from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.core.permissions import member_has_role_at_least
from app.models.event_suggestion import EventSuggestionStatus
from app.models.event_suggestion_comment import EventSuggestionCommentChannel
from app.models.event_suggestion_interest import EventSuggestionInterestVote
from app.models.member import Member, MemberRole
from app.schemas.event_suggestion import (
    EventSuggestionActivityResponse,
    EventSuggestionBoardReviewRequest,
    EventSuggestionCommentCreateRequest,
    EventSuggestionCommentListResponse,
    EventSuggestionCommentResponse,
    EventSuggestionCommunityInsightResponse,
    EventSuggestionConvertRequest,
    EventSuggestionCreateRequest,
    EventSuggestionInterestCounts,
    EventSuggestionInterestUpdateRequest,
    EventSuggestionListResponse,
    EventSuggestionMemberResponse,
    EventSuggestionPollCreateRequest,
    EventSuggestionPollGetResponse,
    EventSuggestionPollListResponse,
    EventSuggestionPollResponse,
    EventSuggestionPollVoteRequest,
    EventSuggestionRelatedResponse,
    EventSuggestionResponse,
    EventSuggestionStatusUpdateRequest,
)
from app.services.event_suggestion_comment_service import (
    EventSuggestionCommentClosedError,
    EventSuggestionCommentEmptyError,
    EventSuggestionCommentForbiddenError,
    EventSuggestionCommentInvalidParentError,
    EventSuggestionCommentNotFoundError,
    build_comment_threads,
    comment_display_content,
    create_event_suggestion_comment,
    list_event_suggestion_comments,
    soft_delete_event_suggestion_comment,
)
from app.services.event_suggestion_insight_service import (
    get_event_suggestion_community_insight,
)
from app.services.event_suggestion_polish_service import (
    EventSuggestionPollError,
    build_event_suggestion_activity,
    close_event_suggestion_poll,
    create_event_suggestion_poll,
    get_suggestion_engagement_stats,
    list_event_suggestion_polls,
    list_related_event_suggestions,
    record_event_suggestion_view,
    vote_event_suggestion_poll,
)
from app.services.event_suggestion_service import (
    EventSuggestionInterestClosedError,
    EventSuggestionInvalidStatusError,
    EventSuggestionNotConvertibleError,
    EventSuggestionNotFoundError,
    EventSuggestionReviewEmptyError,
    apply_event_suggestion_board_review,
    clear_event_suggestion_interest,
    convert_event_suggestion_to_event,
    create_event_suggestion,
    empty_interest_counts,
    get_interest_counts_by_suggestion,
    get_my_interest_by_suggestion,
    list_event_suggestions,
    set_event_suggestion_interest,
    update_event_suggestion_status,
)

router = APIRouter(prefix="/event-suggestions", tags=["event-suggestions"])


def _to_response(
    suggestion,
    *,
    member: Member,
    interest_counts: EventSuggestionInterestCounts | None = None,
    my_interest: EventSuggestionInterestVote | None = None,
    engagement: dict | None = None,
) -> EventSuggestionResponse:
    can_board_review = member_has_role_at_least(member, MemberRole.BOARD)
    stats = engagement or {}
    return EventSuggestionResponse(
        id=suggestion.id,
        title=suggestion.title,
        description=suggestion.description,
        preferred_timing=suggestion.preferred_timing,
        status=suggestion.status.value,
        suggested_by=EventSuggestionMemberResponse.model_validate(
            suggestion.suggested_by
        ),
        noted_by=(
            EventSuggestionMemberResponse.model_validate(suggestion.noted_by)
            if suggestion.noted_by is not None
            else None
        ),
        created_at=suggestion.created_at,
        noted_at=suggestion.noted_at,
        board_note=suggestion.board_note if can_board_review else None,
        board_note_updated_at=(
            suggestion.board_note_updated_at if can_board_review else None
        ),
        board_note_updated_by=(
            EventSuggestionMemberResponse.model_validate(
                suggestion.board_note_updated_by
            )
            if can_board_review and suggestion.board_note_updated_by is not None
            else None
        ),
        can_board_review=can_board_review,
        converted_event_id=suggestion.converted_event_id,
        published_at=suggestion.published_at,
        community_interest_enabled=bool(
            getattr(suggestion, "community_interest_enabled", True)
        ),
        community_discussion_enabled=bool(
            getattr(suggestion, "community_discussion_enabled", True)
        ),
        community_visibility=str(
            getattr(suggestion, "community_visibility", "members") or "members"
        ),
        community_feedback_closed_at=getattr(
            suggestion, "community_feedback_closed_at", None
        ),
        view_count=int(suggestion.view_count or 0),
        board_comment_count=int(stats.get("board_comment_count") or 0),
        community_comment_count=int(stats.get("community_comment_count") or 0),
        poll_count=int(stats.get("poll_count") or 0),
        open_poll_count=int(stats.get("open_poll_count") or 0),
        poll_vote_count=int(stats.get("poll_vote_count") or 0),
        eligible_member_count=int(stats.get("eligible_member_count") or 0),
        last_activity_at=stats.get("last_activity_at"),
        interest_counts=interest_counts or empty_interest_counts(),
        my_interest=my_interest.value if my_interest is not None else None,
    )


def _responses_for(
    db: Session,
    rows: list,
    *,
    member: Member,
    with_engagement: bool = False,
) -> list[EventSuggestionResponse]:
    ids = [row.id for row in rows]
    counts = get_interest_counts_by_suggestion(db, suggestion_ids=ids)
    mine = get_my_interest_by_suggestion(
        db,
        suggestion_ids=ids,
        member_id=member.id,
    )
    include_board = member_has_role_at_least(member, MemberRole.BOARD)
    return [
        _to_response(
            row,
            member=member,
            interest_counts=counts.get(row.id),
            my_interest=mine.get(row.id),
            engagement=(
                get_suggestion_engagement_stats(
                    db,
                    suggestion_id=row.id,
                    include_board=include_board,
                )
                if with_engagement
                else None
            ),
        )
        for row in rows
    ]


@router.get("", response_model=EventSuggestionListResponse)
def list_event_suggestions_endpoint(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    rows = list_event_suggestions(db, member=current_member)
    return EventSuggestionListResponse(
        suggestions=_responses_for(db, rows, member=current_member),
        total=len(rows),
    )


@router.get("/{suggestion_id}", response_model=EventSuggestionResponse)
def get_event_suggestion_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        suggestion = record_event_suggestion_view(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None

    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


@router.post(
    "", response_model=EventSuggestionResponse, status_code=status.HTTP_201_CREATED
)
def create_event_suggestion_endpoint(
    data: EventSuggestionCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    suggestion = create_event_suggestion(db, member=current_member, data=data)
    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


@router.patch("/{suggestion_id}/status", response_model=EventSuggestionResponse)
def update_event_suggestion_status_endpoint(
    suggestion_id: int,
    data: EventSuggestionStatusUpdateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        suggestion = update_event_suggestion_status(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
            status=EventSuggestionStatus(data.status),
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionInvalidStatusError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status update",
        ) from None

    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


@router.patch("/{suggestion_id}/review", response_model=EventSuggestionResponse)
def review_event_suggestion_endpoint(
    suggestion_id: int,
    data: EventSuggestionBoardReviewRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    update_board_note = "board_note" in data.model_fields_set
    try:
        suggestion = apply_event_suggestion_board_review(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
            status=(
                EventSuggestionStatus(data.status) if data.status is not None else None
            ),
            board_note=data.board_note,
            update_board_note=update_board_note,
            feedback_package=data.feedback_package,
            community_visibility=data.community_visibility,
            community_feedback_closed=data.community_feedback_closed,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionReviewEmptyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a status and/or board note",
        ) from None
    except EventSuggestionInvalidStatusError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review status",
        ) from None

    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


@router.post(
    "/{suggestion_id}/convert",
    response_model=EventSuggestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def convert_event_suggestion_endpoint(
    suggestion_id: int,
    data: EventSuggestionConvertRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        suggestion = convert_event_suggestion_to_event(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
            data=data,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionNotConvertibleError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved ideas can be converted to events",
        ) from None

    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


def _comment_to_response(
    comment,
    *,
    member: Member,
    replies: list | None = None,
) -> EventSuggestionCommentResponse:
    can_delete = comment.deleted_at is None and (
        comment.author_id == member.id
        or member_has_role_at_least(member, MemberRole.BOARD)
    )
    return EventSuggestionCommentResponse(
        id=comment.id,
        suggestion_id=comment.suggestion_id,
        parent_id=comment.parent_id,
        content=comment_display_content(comment),
        author=EventSuggestionMemberResponse.model_validate(comment.author),
        created_at=comment.created_at,
        deleted_at=comment.deleted_at,
        is_deleted=comment.deleted_at is not None,
        can_delete=can_delete,
        replies=[
            _comment_to_response(reply, member=member, replies=[])
            for reply in (replies or [])
        ],
    )


def _list_comments_for_channel(
    *,
    db: Session,
    suggestion_id: int,
    member: Member,
    channel: EventSuggestionCommentChannel,
) -> EventSuggestionCommentListResponse:
    try:
        rows = list_event_suggestion_comments(
            db,
            suggestion_id=suggestion_id,
            member=member,
            channel=channel,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionCommentForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Board discussion is only visible to officers",
        ) from None

    top_level, replies_by_parent, live_total = build_comment_threads(rows)
    return EventSuggestionCommentListResponse(
        comments=[
            _comment_to_response(
                comment,
                member=member,
                replies=replies_by_parent.get(comment.id, []),
            )
            for comment in top_level
        ],
        total=live_total,
    )


def _create_comment_for_channel(
    *,
    db: Session,
    suggestion_id: int,
    member: Member,
    data: EventSuggestionCommentCreateRequest,
    channel: EventSuggestionCommentChannel,
) -> EventSuggestionCommentResponse:
    try:
        comment = create_event_suggestion_comment(
            db,
            suggestion_id=suggestion_id,
            member=member,
            data=data,
            channel=channel,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionCommentForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Board discussion is only available to officers",
        ) from None
    except EventSuggestionCommentClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Board discussion is closed for this idea"
                if channel == EventSuggestionCommentChannel.BOARD
                else "Discussion is closed for this idea"
            ),
        ) from None
    except EventSuggestionCommentEmptyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment cannot be empty",
        ) from None
    except EventSuggestionCommentInvalidParentError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid parent comment",
        ) from None

    return _comment_to_response(comment, member=member, replies=[])


def _delete_comment_for_channel(
    *,
    db: Session,
    suggestion_id: int,
    comment_id: int,
    member: Member,
    channel: EventSuggestionCommentChannel,
) -> EventSuggestionCommentResponse:
    try:
        comment = soft_delete_event_suggestion_comment(
            db,
            suggestion_id=suggestion_id,
            comment_id=comment_id,
            member=member,
            channel=channel,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionCommentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        ) from None
    except EventSuggestionCommentForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete this comment",
        ) from None

    return _comment_to_response(comment, member=member, replies=[])


@router.get(
    "/{suggestion_id}/comments",
    response_model=EventSuggestionCommentListResponse,
)
def list_event_suggestion_comments_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return _list_comments_for_channel(
        db=db,
        suggestion_id=suggestion_id,
        member=current_member,
        channel=EventSuggestionCommentChannel.COMMUNITY,
    )


@router.post(
    "/{suggestion_id}/comments",
    response_model=EventSuggestionCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_suggestion_comment_endpoint(
    suggestion_id: int,
    data: EventSuggestionCommentCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return _create_comment_for_channel(
        db=db,
        suggestion_id=suggestion_id,
        member=current_member,
        data=data,
        channel=EventSuggestionCommentChannel.COMMUNITY,
    )


@router.delete(
    "/{suggestion_id}/comments/{comment_id}",
    response_model=EventSuggestionCommentResponse,
)
def delete_event_suggestion_comment_endpoint(
    suggestion_id: int,
    comment_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    return _delete_comment_for_channel(
        db=db,
        suggestion_id=suggestion_id,
        comment_id=comment_id,
        member=current_member,
        channel=EventSuggestionCommentChannel.COMMUNITY,
    )


@router.get(
    "/{suggestion_id}/board-comments",
    response_model=EventSuggestionCommentListResponse,
)
def list_event_suggestion_board_comments_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    return _list_comments_for_channel(
        db=db,
        suggestion_id=suggestion_id,
        member=current_member,
        channel=EventSuggestionCommentChannel.BOARD,
    )


@router.post(
    "/{suggestion_id}/board-comments",
    response_model=EventSuggestionCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_suggestion_board_comment_endpoint(
    suggestion_id: int,
    data: EventSuggestionCommentCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    return _create_comment_for_channel(
        db=db,
        suggestion_id=suggestion_id,
        member=current_member,
        data=data,
        channel=EventSuggestionCommentChannel.BOARD,
    )


@router.delete(
    "/{suggestion_id}/board-comments/{comment_id}",
    response_model=EventSuggestionCommentResponse,
)
def delete_event_suggestion_board_comment_endpoint(
    suggestion_id: int,
    comment_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    return _delete_comment_for_channel(
        db=db,
        suggestion_id=suggestion_id,
        comment_id=comment_id,
        member=current_member,
        channel=EventSuggestionCommentChannel.BOARD,
    )


@router.put("/{suggestion_id}/interest", response_model=EventSuggestionResponse)
def set_event_suggestion_interest_endpoint(
    suggestion_id: int,
    data: EventSuggestionInterestUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        suggestion = set_event_suggestion_interest(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
            vote=EventSuggestionInterestVote(data.vote),
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionInterestClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interest voting is closed for this idea",
        ) from None

    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


@router.delete("/{suggestion_id}/interest", response_model=EventSuggestionResponse)
def clear_event_suggestion_interest_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        suggestion = clear_event_suggestion_interest(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionInterestClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interest voting is closed for this idea",
        ) from None

    return _responses_for(db, [suggestion], member=current_member, with_engagement=True)[0]


@router.get(
    "/{suggestion_id}/community-insight",
    response_model=EventSuggestionCommunityInsightResponse,
)
def get_event_suggestion_community_insight_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return get_event_suggestion_community_insight(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None


@router.get(
    "/{suggestion_id}/activity",
    response_model=EventSuggestionActivityResponse,
)
def list_event_suggestion_activity_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        items = build_event_suggestion_activity(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    return EventSuggestionActivityResponse(items=items)


@router.get(
    "/{suggestion_id}/related",
    response_model=EventSuggestionRelatedResponse,
)
def list_related_event_suggestions_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        ideas = list_related_event_suggestions(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    return EventSuggestionRelatedResponse(ideas=ideas)


@router.get(
    "/{suggestion_id}/polls",
    response_model=EventSuggestionPollListResponse,
)
def list_event_suggestion_polls_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        polls = list_event_suggestion_polls(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    return EventSuggestionPollListResponse(polls=polls)


@router.get(
    "/{suggestion_id}/poll",
    response_model=EventSuggestionPollGetResponse,
)
def get_event_suggestion_poll_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        polls = list_event_suggestion_polls(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    return EventSuggestionPollGetResponse(
        poll=polls[0] if polls else None,
        polls=polls,
    )


@router.post(
    "/{suggestion_id}/poll",
    response_model=EventSuggestionPollResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/{suggestion_id}/polls",
    response_model=EventSuggestionPollResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_suggestion_poll_endpoint(
    suggestion_id: int,
    data: EventSuggestionPollCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return create_event_suggestion_poll(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
            data=data,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionPollError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create poll for this idea",
        ) from None


@router.put(
    "/{suggestion_id}/polls/{poll_id}/vote",
    response_model=EventSuggestionPollResponse,
)
def vote_event_suggestion_poll_by_id_endpoint(
    suggestion_id: int,
    poll_id: int,
    data: EventSuggestionPollVoteRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return vote_event_suggestion_poll(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
            option_id=data.option_id,
            poll_id=poll_id,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionPollError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to record poll vote",
        ) from None


@router.put(
    "/{suggestion_id}/poll/vote",
    response_model=EventSuggestionPollResponse,
)
def vote_event_suggestion_poll_endpoint(
    suggestion_id: int,
    data: EventSuggestionPollVoteRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return vote_event_suggestion_poll(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
            option_id=data.option_id,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionPollError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to record poll vote",
        ) from None


@router.post(
    "/{suggestion_id}/polls/{poll_id}/close",
    response_model=EventSuggestionPollResponse,
)
def close_event_suggestion_poll_by_id_endpoint(
    suggestion_id: int,
    poll_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return close_event_suggestion_poll(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
            poll_id=poll_id,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionPollError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to close poll",
        ) from None


@router.post(
    "/{suggestion_id}/poll/close",
    response_model=EventSuggestionPollResponse,
)
def close_event_suggestion_poll_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return close_event_suggestion_poll(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionPollError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to close poll",
        ) from None
