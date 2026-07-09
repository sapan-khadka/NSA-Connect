from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.event_suggestion import (
    EventSuggestionCreateRequest,
    EventSuggestionListResponse,
    EventSuggestionMemberResponse,
    EventSuggestionResponse,
    EventSuggestionStatusUpdateRequest,
)
from app.services.event_suggestion_service import (
    EventSuggestionNotFoundError,
    create_event_suggestion,
    list_event_suggestions,
    mark_event_suggestion_noted,
)

router = APIRouter(prefix="/event-suggestions", tags=["event-suggestions"])


def _to_response(suggestion) -> EventSuggestionResponse:
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
    )


@router.get("", response_model=EventSuggestionListResponse)
def list_event_suggestions_endpoint(
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    rows = list_event_suggestions(db)
    return EventSuggestionListResponse(
        suggestions=[_to_response(row) for row in rows],
        total=len(rows),
    )


@router.post(
    "", response_model=EventSuggestionResponse, status_code=status.HTTP_201_CREATED
)
def create_event_suggestion_endpoint(
    data: EventSuggestionCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    suggestion = create_event_suggestion(db, member=current_member, data=data)
    return _to_response(suggestion)


@router.patch("/{suggestion_id}/status", response_model=EventSuggestionResponse)
def update_event_suggestion_status_endpoint(
    suggestion_id: int,
    data: EventSuggestionStatusUpdateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        suggestion = mark_event_suggestion_noted(
            db,
            suggestion_id=suggestion_id,
            board_member=current_member,
        )
    except EventSuggestionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event suggestion not found",
        ) from None

    return _to_response(suggestion)
