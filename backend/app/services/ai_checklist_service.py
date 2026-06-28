import json
import logging
import re

from pydantic import ValidationError

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.models.event import EventType
from app.prompts.checklist_generator import (
    CHECKLIST_GENERATOR_SYSTEM_PROMPT,
    build_checklist_user_prompt,
)
from app.schemas.ai import ChecklistCategoryResponse, GenerateChecklistResponse

logger = logging.getLogger(__name__)

_JSON_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class AIDisabledError(Exception):
    pass


class AIChecklistGenerationError(Exception):
    pass


def _extract_json_payload(raw_text: str) -> dict:
    cleaned = _JSON_FENCE_PATTERN.sub("", raw_text.strip())
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIChecklistGenerationError("Anthropic returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise AIChecklistGenerationError("Anthropic response must be a JSON object")

    return payload


def generate_event_checklist(
    *,
    event_name: str,
    event_type: EventType,
    tasks: list[str] | None = None,
) -> GenerateChecklistResponse:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIChecklistGenerationError("Anthropic is not configured") from exc

    try:
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2048,
            system=CHECKLIST_GENERATOR_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": build_checklist_user_prompt(
                        event_name=event_name,
                        event_type=event_type,
                        tasks=tasks or [],
                    ),
                }
            ],
        )
    except Exception as exc:
        logger.exception(
            "Anthropic checklist generation failed for event=%s",
            event_name,
        )
        raise AIChecklistGenerationError("Failed to generate checklist") from exc

    text_blocks = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text" and block.text.strip()
    ]
    if not text_blocks:
        raise AIChecklistGenerationError("Anthropic returned an empty response")

    payload = _extract_json_payload(text_blocks[0])

    try:
        parsed = GenerateChecklistResponse.model_validate(payload)
    except ValidationError as exc:
        raise AIChecklistGenerationError(
            "Anthropic response did not match checklist schema",
        ) from exc

    if not parsed.categories:
        raise AIChecklistGenerationError("Anthropic returned no checklist categories")

    normalized_categories: list[ChecklistCategoryResponse] = []
    for category in parsed.categories:
        cleaned_tasks = [task.strip() for task in category.tasks if task.strip()]
        cleaned_category = category.category.strip()
        if cleaned_category and cleaned_tasks:
            normalized_categories.append(
                ChecklistCategoryResponse(
                    category=cleaned_category,
                    tasks=cleaned_tasks,
                )
            )

    if not normalized_categories:
        raise AIChecklistGenerationError("Anthropic returned no usable checklist tasks")

    return GenerateChecklistResponse(categories=normalized_categories)
