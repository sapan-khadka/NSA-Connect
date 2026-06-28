from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import require_board
from app.models.member import Member
from app.schemas.ai import (
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


@router.post(
    "/generate-checklist",
    response_model=GenerateChecklistResponse,
    status_code=status.HTTP_200_OK,
)
def generate_checklist_endpoint(
    data: GenerateChecklistRequest,
    _: Member = Depends(require_board),
) -> GenerateChecklistResponse:
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
    except AIChecklistGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from None


@router.post(
    "/draft-announcement-email",
    response_model=DraftAnnouncementEmailResponse,
    status_code=status.HTTP_200_OK,
)
def draft_announcement_email_endpoint(
    data: DraftAnnouncementEmailRequest,
    _: Member = Depends(require_board),
) -> DraftAnnouncementEmailResponse:
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
    except AIAnnouncementDraftError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from None


@router.post(
    "/summarize-minutes",
    response_model=SummarizeMinutesResponse,
    status_code=status.HTTP_200_OK,
)
def summarize_minutes_endpoint(
    data: SummarizeMinutesRequest,
    _: Member = Depends(require_board),
) -> SummarizeMinutesResponse:
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
    except AIMinutesSummaryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from None
