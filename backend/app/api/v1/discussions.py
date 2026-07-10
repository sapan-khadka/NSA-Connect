from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.discussion import (
    DiscussionMessageCreateRequest,
    DiscussionMessageListResponse,
    DiscussionMessageResponse,
)
from app.services.discussion_service import (
    DEFAULT_DISCUSSION_LIMIT,
    DiscussionForbiddenError,
    DiscussionValidationError,
    create_board_discussion_message,
    create_event_discussion_message,
    list_board_discussion_messages,
    list_event_discussion_messages,
)
from app.services.event_service import EventNotFoundError

router = APIRouter(tags=["discussions"])

DISCUSSION_FORBIDDEN_DETAIL = "You do not have access to this discussion"


def _to_response(message) -> DiscussionMessageResponse:
    return DiscussionMessageResponse.model_validate(message)


@router.get(
    "/events/{event_id}/discussion",
    response_model=DiscussionMessageListResponse,
)
def list_event_discussion_endpoint(
    event_id: int,
    after_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=DEFAULT_DISCUSSION_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        messages = list_event_discussion_messages(
            db,
            event_id=event_id,
            member=current_member,
            after_id=after_id,
            limit=limit,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except DiscussionForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DISCUSSION_FORBIDDEN_DETAIL,
        ) from None

    return DiscussionMessageListResponse(
        messages=[_to_response(message) for message in messages],
        total=len(messages),
    )


@router.post(
    "/events/{event_id}/discussion",
    response_model=DiscussionMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_discussion_endpoint(
    event_id: int,
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        message = create_event_discussion_message(
            db,
            event_id=event_id,
            member=current_member,
            content=data.content,
        )
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except DiscussionForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DISCUSSION_FORBIDDEN_DETAIL,
        ) from None
    except DiscussionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None

    return _to_response(message)


@router.get(
    "/board/discussion",
    response_model=DiscussionMessageListResponse,
)
def list_board_discussion_endpoint(
    after_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=DEFAULT_DISCUSSION_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    messages = list_board_discussion_messages(
        db,
        member=current_member,
        after_id=after_id,
        limit=limit,
    )
    return DiscussionMessageListResponse(
        messages=[_to_response(message) for message in messages],
        total=len(messages),
    )


@router.post(
    "/board/discussion",
    response_model=DiscussionMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_board_discussion_endpoint(
    data: DiscussionMessageCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    try:
        message = create_board_discussion_message(
            db,
            member=current_member,
            content=data.content,
        )
    except DiscussionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None

    return _to_response(message)
