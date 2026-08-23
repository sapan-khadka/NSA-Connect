from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.core.rate_limit import AppRateLimitExceeded, enforce_ai_user_limit
from app.core.safe_messages import GENERIC_AI_UNAVAILABLE
from app.core.security_events import log_security_event
from app.models.member import Member
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    DraftAnnouncementEmailRequest,
    DraftAnnouncementEmailResponse,
    GenerateChecklistRequest,
    GenerateChecklistResponse,
    SummarizeMinutesRequest,
    SummarizeMinutesResponse,
)
from app.services.ai_announcement_service import (
    AIAnnouncementDraftError,
    draft_event_announcement_email,
)
from app.services.ai_chat_service import (
    AIChatError,
    chat_with_nsa_assistant,
    stream_chat_with_nsa_assistant,
)
from app.services.ai_checklist_service import (
    AIChecklistGenerationError,
    AIDisabledError,
    generate_event_checklist,
)
from app.services.ai_minutes_service import (
    AIMinutesSummaryError,
    summarize_meeting_minutes,
)

router = APIRouter(prefix="/ai", tags=["ai"])


def _enforce_ai_quota(request: Request, member: Member) -> None:
    try:
        enforce_ai_user_limit(member.id)
    except AppRateLimitExceeded as exc:
        log_security_event(
            "ai_rate_limited",
            request=request,
            member_id=member.id,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.detail,
        ) from None


@router.post(
    "/generate-checklist",
    response_model=GenerateChecklistResponse,
    status_code=status.HTTP_200_OK,
)
def generate_checklist_endpoint(
    request: Request,
    data: GenerateChecklistRequest,
    current_member: Member = Depends(require_board),
) -> GenerateChecklistResponse:
    _enforce_ai_quota(request, current_member)
    try:
        return generate_event_checklist(
            event_name=data.event_name,
            event_type=data.event_type,
            tasks=data.tasks,
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIChecklistGenerationError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_AI_UNAVAILABLE,
        ) from None


@router.post(
    "/draft-announcement-email",
    response_model=DraftAnnouncementEmailResponse,
    status_code=status.HTTP_200_OK,
)
def draft_announcement_email_endpoint(
    request: Request,
    data: DraftAnnouncementEmailRequest,
    current_member: Member = Depends(require_board),
) -> DraftAnnouncementEmailResponse:
    _enforce_ai_quota(request, current_member)
    try:
        return draft_event_announcement_email(
            event_name=data.event_name,
            event_type=data.event_type,
            starts_at=data.starts_at,
            location=data.location,
            description=data.description,
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIAnnouncementDraftError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_AI_UNAVAILABLE,
        ) from None


@router.post(
    "/summarize-minutes",
    response_model=SummarizeMinutesResponse,
    status_code=status.HTTP_200_OK,
)
def summarize_minutes_endpoint(
    request: Request,
    data: SummarizeMinutesRequest,
    current_member: Member = Depends(require_board),
) -> SummarizeMinutesResponse:
    _enforce_ai_quota(request, current_member)
    try:
        return summarize_meeting_minutes(
            notes=data.notes,
            meeting_title=data.meeting_title,
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIMinutesSummaryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_AI_UNAVAILABLE,
        ) from None


@router.post("/chat/stream")
def chat_stream_endpoint(
    request: Request,
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
) -> StreamingResponse:
    _enforce_ai_quota(request, current_member)
    try:
        event_stream = stream_chat_with_nsa_assistant(
            db,
            member=current_member,
            data=data,
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIChatError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_AI_UNAVAILABLE,
        ) from None

    return StreamingResponse(
        event_stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
)
def chat_endpoint(
    request: Request,
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
) -> ChatResponse:
    _enforce_ai_quota(request, current_member)
    try:
        return chat_with_nsa_assistant(
            db,
            member=current_member,
            data=data,
        )
    except AIDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled",
        ) from None
    except AIChatError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_AI_UNAVAILABLE,
        ) from None
