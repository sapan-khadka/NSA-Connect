import json
import logging
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.lib.event_timezone import format_event_moment, resolve_event_timezone
from app.prompts.meeting_minutes import (
    MEETING_MINUTES_SYSTEM_PROMPT,
    build_meeting_minutes_user_prompt,
)
from app.schemas.ai import (
    MeetingActionItemResponse,
    SummarizeMinutesResponse,
)
from app.services.ai_checklist_service import AIDisabledError
from app.services.minutes_grounding import (
    ground_action_item,
    ground_decision,
    ground_summary,
)

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


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _optional_text(value: object) -> str | None:
    text = _text(value)
    return text or None


def _decision_parts(item: object) -> tuple[str, str] | None:
    if not isinstance(item, dict):
        return None
    text = _text(item.get("text") or item.get("decision"))
    evidence = _text(item.get("evidence"))
    if not text or not evidence:
        return None
    return text, evidence


def _action_parts(item: object) -> dict[str, str | None] | None:
    if not isinstance(item, dict):
        return None
    task = _text(item.get("task"))
    evidence = _text(item.get("evidence"))
    if not task or not evidence:
        return None
    return {
        "task": task,
        "owner": _optional_text(item.get("owner")),
        "due": _optional_text(item.get("due")),
        "evidence": evidence,
    }


def _meeting_context(
    starts_at: datetime | None,
    timezone: ZoneInfo | None,
) -> tuple[str | None, int | None, str | None, datetime | None]:
    if starts_at is None:
        return None, None, None, None
    zone = timezone or resolve_event_timezone(None)
    local = starts_at
    if local.tzinfo is None or local.tzinfo.utcoffset(local) is None:
        from datetime import UTC

        local = local.replace(tzinfo=UTC)
    local = local.astimezone(zone)
    timezone_name = getattr(zone, "key", None) or str(zone)
    return format_event_moment(starts_at, zone), local.year, timezone_name, local


def summarize_meeting_minutes(
    *,
    notes: str,
    meeting_title: str | None = None,
    starts_at: datetime | None = None,
    timezone: ZoneInfo | None = None,
) -> SummarizeMinutesResponse:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIMinutesSummaryError("Anthropic is not configured") from exc

    meeting_when, meeting_year, timezone_name, meeting_local = _meeting_context(
        starts_at,
        timezone,
    )
    meeting_date = meeting_local.date() if meeting_local is not None else None

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
                        meeting_when=meeting_when,
                        meeting_year=meeting_year,
                        timezone_name=timezone_name,
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
    summary = ground_summary(_text(payload.get("summary")), notes)
    if not summary:
        raise AIMinutesSummaryError("Anthropic returned an empty summary")

    raw_decisions = payload.get("key_decisions")
    raw_actions = payload.get("action_items")
    if not isinstance(raw_decisions, list):
        raw_decisions = []
    if not isinstance(raw_actions, list):
        raw_actions = []

    key_decisions: list[str] = []
    for item in raw_decisions:
        parts = _decision_parts(item)
        if parts is None:
            continue
        decision = ground_decision(notes, parts[0], parts[1])
        if decision and decision not in key_decisions:
            key_decisions.append(decision)

    action_items: list[MeetingActionItemResponse] = []
    for item in raw_actions:
        parts = _action_parts(item)
        if parts is None:
            continue
        grounded = ground_action_item(
            notes=notes,
            task=str(parts["task"]),
            owner=parts["owner"],
            due=parts["due"],
            evidence=str(parts["evidence"]),
            meeting=meeting_date,
        )
        if grounded is None:
            continue
        action_items.append(
            MeetingActionItemResponse(
                task=str(grounded["task"]),
                owner=grounded["owner"],
                due=grounded["due"],
            )
        )

    return SummarizeMinutesResponse(
        summary=summary,
        key_decisions=key_decisions,
        action_items=action_items,
    )
