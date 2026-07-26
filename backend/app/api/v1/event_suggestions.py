from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.event_suggestion import EventSuggestionStatus
from app.models.event_suggestion_interest import EventSuggestionInterestVote
from app.models.member import Member
from app.schemas.event_suggestion import (
    EventSuggestionCreateRequest,
    EventSuggestionInterestCounts,
    EventSuggestionInterestUpdateRequest,
    EventSuggestionListResponse,
    EventSuggestionMemberResponse,
    EventSuggestionResponse,
    EventSuggestionStatusUpdateRequest,
)
from app.services.event_suggestion_service import (
    EventSuggestionInterestClosedError,
    EventSuggestionInvalidStatusError,
    EventSuggestionNotFoundError,
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
    interest_counts: EventSuggestionInterestCounts | None = None,
    my_interest: EventSuggestionInterestVote | None = None,
) -> EventSuggestionResponse:
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
