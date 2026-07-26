from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.event_suggestion import EventSuggestionStatus
from app.models.event_suggestion_interest import EventSuggestionInterestVote
from app.models.member import Member, MemberRole
from app.schemas.event_suggestion import (
    EventSuggestionBoardReviewRequest,
    EventSuggestionCommentCreateRequest,
    EventSuggestionCommentListResponse,
    EventSuggestionCommentResponse,
    EventSuggestionCreateRequest,
    EventSuggestionInterestCounts,
    EventSuggestionInterestUpdateRequest,
    EventSuggestionListResponse,
    EventSuggestionMemberResponse,
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
from app.services.event_suggestion_service import (
    EventSuggestionInterestClosedError,
    EventSuggestionInvalidStatusError,
    EventSuggestionNotFoundError,
    EventSuggestionReviewEmptyError,
    apply_event_suggestion_board_review,
    clear_event_suggestion_interest,
    create_event_suggestion,
    empty_interest_counts,
    get_event_suggestion,
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
) -> EventSuggestionResponse:
    can_board_review = member.has_role_at_least(MemberRole.BOARD)
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
        can_board_review=can_board_review,
        interest_counts=interest_counts or empty_interest_counts(),
        my_interest=my_interest.value if my_interest is not None else None,
    )


def _responses_for(
    db: Session,
    rows: list,
    *,
    member: Member,
) -> list[EventSuggestionResponse]:
    ids = [row.id for row in rows]
    counts = get_interest_counts_by_suggestion(db, suggestion_ids=ids)
    mine = get_my_interest_by_suggestion(
        db,
        suggestion_ids=ids,
        member_id=member.id,
    )
    return [
        _to_response(
            row,
            member=member,
            interest_counts=counts.get(row.id),
            my_interest=mine.get(row.id),
        )
        for row in rows
    ]


@router.get("", response_model=EventSuggestionListResponse)
def list_event_suggestions_endpoint(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    rows = list_event_suggestions(db)
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
        suggestion = get_event_suggestion(db, suggestion_id=suggestion_id)
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None

    return _responses_for(db, [suggestion], member=current_member)[0]


@router.post(
    "", response_model=EventSuggestionResponse, status_code=status.HTTP_201_CREATED
)
def create_event_suggestion_endpoint(
    data: EventSuggestionCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    suggestion = create_event_suggestion(db, member=current_member, data=data)
    return _responses_for(db, [suggestion], member=current_member)[0]


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

    return _responses_for(db, [suggestion], member=current_member)[0]


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

    return _responses_for(db, [suggestion], member=current_member)[0]


def _comment_to_response(
    comment,
    *,
    member: Member,
    replies: list | None = None,
) -> EventSuggestionCommentResponse:
    can_delete = comment.deleted_at is None and (
        comment.author_id == member.id
        or member.has_role_at_least(MemberRole.BOARD)
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


@router.get(
    "/{suggestion_id}/comments",
    response_model=EventSuggestionCommentListResponse,
)
def list_event_suggestion_comments_endpoint(
    suggestion_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        rows = list_event_suggestion_comments(db, suggestion_id=suggestion_id)
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None

    top_level, replies_by_parent, live_total = build_comment_threads(rows)
    return EventSuggestionCommentListResponse(
        comments=[
            _comment_to_response(
                comment,
                member=current_member,
                replies=replies_by_parent.get(comment.id, []),
            )
            for comment in top_level
        ],
        total=live_total,
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
    try:
        comment = create_event_suggestion_comment(
            db,
            suggestion_id=suggestion_id,
            member=current_member,
            data=data,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event idea not found",
        ) from None
    except EventSuggestionCommentClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discussion is closed for this idea",
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

    return _comment_to_response(comment, member=current_member, replies=[])


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
    try:
        comment = soft_delete_event_suggestion_comment(
            db,
            suggestion_id=suggestion_id,
            comment_id=comment_id,
            member=current_member,
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

    return _comment_to_response(comment, member=current_member, replies=[])


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

    return _responses_for(db, [suggestion], member=current_member)[0]


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

    return _responses_for(db, [suggestion], member=current_member)[0]
