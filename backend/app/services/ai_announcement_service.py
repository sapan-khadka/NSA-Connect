import json
import logging
import re
from datetime import datetime

from pydantic import ValidationError

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.models.event import EventType
from app.prompts.announcement_email import (
    ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT,
    build_announcement_user_prompt,
)
from app.schemas.ai import DraftAnnouncementEmailResponse
from app.services.ai_checklist_service import AIDisabledError

logger = logging.getLogger(__name__)

_JSON_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class AIAnnouncementDraftError(Exception):
    pass


def _extract_json_payload(raw_text: str) -> dict:
    cleaned = _JSON_FENCE_PATTERN.sub("", raw_text.strip())
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIAnnouncementDraftError("Anthropic returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise AIAnnouncementDraftError("Anthropic response must be a JSON object")

    return payload


def draft_event_announcement_email(
    *,
    event_name: str,
    event_type: EventType | None = None,
    starts_at: datetime | None = None,
    location: str | None = None,
    description: str | None = None,
) -> DraftAnnouncementEmailResponse:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIAnnouncementDraftError("Anthropic is not configured") from exc

    try:
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2048,
            system=ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": build_announcement_user_prompt(
                        event_name=event_name,
                        event_type=event_type,
                        starts_at=starts_at,
                        location=location,
                        description=description,
                    ),
                }
            ],
        )
    except Exception as exc:
        logger.exception(
            "Anthropic announcement draft failed for event=%s",
            event_name,
        )
        raise AIAnnouncementDraftError("Failed to draft announcement email") from exc

    text_blocks = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text" and block.text.strip()
    ]
    if not text_blocks:
        raise AIAnnouncementDraftError("Anthropic returned an empty response")

    payload = _extract_json_payload(text_blocks[0])

    try:
        parsed = DraftAnnouncementEmailResponse.model_validate(payload)
    except ValidationError as exc:
        raise AIAnnouncementDraftError(
            "Anthropic response did not match announcement schema",
        ) from exc

    subject = parsed.subject.strip()
    body = parsed.body.strip()
    if not subject or not body:
        raise AIAnnouncementDraftError("Anthropic returned an empty announcement")

    return DraftAnnouncementEmailResponse(subject=subject, body=body)
