import json
import logging
import re

from pydantic import ValidationError

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.prompts.meeting_minutes import (
    MEETING_MINUTES_SYSTEM_PROMPT,
    build_meeting_minutes_user_prompt,
)
from app.schemas.ai import (
    MeetingActionItemResponse,
    SummarizeMinutesResponse,
)
from app.services.ai_checklist_service import AIDisabledError

logger = logging.getLogger(__name__)

_JSON_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class AIMinutesSummaryError(Exception):
    pass


def _extract_json_payload(raw_text: str) -> dict:
    cleaned = _JSON_FENCE_PATTERN.sub("", raw_text.strip())
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIMinutesSummaryError("Anthropic returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise AIMinutesSummaryError("Anthropic response must be a JSON object")

    return payload


def _normalize_action_item(
    item: MeetingActionItemResponse,
) -> MeetingActionItemResponse:
    owner = item.owner.strip() if item.owner else None
    due = item.due.strip() if item.due else None
    return MeetingActionItemResponse(
        task=item.task.strip(),
        owner=owner or None,
        due=due or None,
    )


def summarize_meeting_minutes(
    *,
    notes: str,
    meeting_title: str | None = None,
) -> SummarizeMinutesResponse:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIMinutesSummaryError("Anthropic is not configured") from exc

    try:
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=3072,
            system=MEETING_MINUTES_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": build_meeting_minutes_user_prompt(
                        notes=notes,
                        meeting_title=meeting_title,
                    ),
                }
            ],
        )
    except Exception as exc:
        logger.exception("Anthropic minutes summary failed")
        raise AIMinutesSummaryError("Failed to summarize meeting minutes") from exc

    text_blocks = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text" and block.text.strip()
    ]
    if not text_blocks:
        raise AIMinutesSummaryError("Anthropic returned an empty response")

    payload = _extract_json_payload(text_blocks[0])

    try:
        parsed = SummarizeMinutesResponse.model_validate(payload)
    except ValidationError as exc:
        raise AIMinutesSummaryError(
            "Anthropic response did not match minutes schema",
        ) from exc

    summary = parsed.summary.strip()
    if not summary:
        raise AIMinutesSummaryError("Anthropic returned an empty summary")

    key_decisions = [
        decision.strip() for decision in parsed.key_decisions if decision.strip()
    ]
    action_items = [
        normalized
        for item in parsed.action_items
        if (normalized := _normalize_action_item(item)).task
    ]

    return SummarizeMinutesResponse(
        summary=summary,
        key_decisions=key_decisions,
        action_items=action_items,
    )
