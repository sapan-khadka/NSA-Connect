import base64
import json
import logging
import re
from decimal import Decimal, InvalidOperation

from pydantic import ValidationError

from app.core.config import get_settings
from app.integrations.openai_client import (
    OpenAINotConfiguredError,
    get_openai_client,
)
from app.lib.finance_categories import is_known_finance_category
from app.models.finance_entry import FinanceCategory
from app.prompts.receipt_scan import (
    RECEIPT_SCAN_SYSTEM_PROMPT,
    build_receipt_scan_user_prompt,
)
from app.schemas.finance import ReceiptScanResponse
from app.services.ai_checklist_service import AIDisabledError
from app.services.receipt_upload_service import (
    ALLOWED_IMAGE_CONTENT_TYPES,
    ReceiptValidationError,
    validate_image_file,
)

logger = logging.getLogger(__name__)

_JSON_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_PATTERN = re.compile(r"^\d{2}:\d{2}$")

# Categories that make sense for typical expense receipts (exclude income-only).
_SUGGESTABLE_CATEGORIES = frozenset(
    {
        FinanceCategory.FOOD_BEVERAGE.value,
        FinanceCategory.SUPPLIES.value,
        FinanceCategory.MARKETING.value,
        FinanceCategory.TRAVEL.value,
        FinanceCategory.VENUE.value,
        FinanceCategory.EVENT.value,
        FinanceCategory.OTHER.value,
    }
)


class ReceiptScanError(Exception):
    pass


def _extract_json_payload(raw_text: str) -> dict:
    cleaned = _JSON_FENCE_PATTERN.sub("", raw_text.strip())
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ReceiptScanError("OpenAI returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise ReceiptScanError("OpenAI response must be a JSON object")

    return payload


def _normalize_amount(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        text = str(value)
    elif isinstance(value, str):
        text = value.strip().replace("$", "").replace(",", "")
        if not text:
            return None
    else:
        return None

    try:
        amount = Decimal(text)
    except InvalidOperation:
        return None

    if amount <= 0:
        return None

    quantized = amount.quantize(Decimal("0.01"))
    if quantized > Decimal("999999.99"):
        return None
    return quantized


def _normalize_optional_str(value: object, *, max_length: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:max_length]


def _normalize_category(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    cleaned = value.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "food": FinanceCategory.FOOD_BEVERAGE.value,
        "food_and_beverage": FinanceCategory.FOOD_BEVERAGE.value,
        "food_&_beverage": FinanceCategory.FOOD_BEVERAGE.value,
    }
    cleaned = aliases.get(cleaned, cleaned)
    if cleaned not in _SUGGESTABLE_CATEGORIES:
        return None
    if not is_known_finance_category(cleaned):
        return None
    return cleaned


def _normalize_date(value: object) -> str | None:
    text = _normalize_optional_str(value, max_length=10)
    if text is None or not _DATE_PATTERN.match(text):
        return None
    return text


def _normalize_time(value: object) -> str | None:
    text = _normalize_optional_str(value, max_length=5)
    if text is None or not _TIME_PATTERN.match(text):
        return None
    return text


def _build_description(
    *,
    vendor: str | None,
    description: str | None,
    purchase_date: str | None,
) -> str | None:
    parts: list[str] = []
    if vendor and description and vendor.lower() not in description.lower():
        parts.append(f"{vendor} — {description}")
    elif description:
        parts.append(description)
    elif vendor:
        parts.append(vendor)

    if purchase_date and parts:
        parts[0] = f"{parts[0]} (purchased {purchase_date})"
    elif purchase_date:
        parts.append(f"Purchased {purchase_date}")

    if not parts:
        return None
    return parts[0][:5000]


def _to_scan_response(payload: dict) -> ReceiptScanResponse:
    is_receipt = payload.get("is_receipt")
    if is_receipt is False:
        return ReceiptScanResponse(
            readable=False,
            vendor=None,
            purchase_date=None,
            purchase_time=None,
            amount=None,
            description=None,
            category=None,
            confidence="low",
        )

    amount = _normalize_amount(payload.get("amount"))
    confidence_raw = payload.get("confidence")
    confidence = "high" if confidence_raw == "high" and amount is not None else "low"
    vendor = _normalize_optional_str(payload.get("vendor"), max_length=200)
    purchase_date = _normalize_date(payload.get("purchase_date"))
    purchase_time = _normalize_time(payload.get("purchase_time"))
    raw_description = _normalize_optional_str(
        payload.get("description"),
        max_length=5000,
    )
    description = _build_description(
        vendor=vendor,
        description=raw_description,
        purchase_date=purchase_date,
    )
    category = _normalize_category(payload.get("category"))

    readable = amount is not None and confidence == "high"

    return ReceiptScanResponse(
        readable=readable,
        vendor=vendor,
        purchase_date=purchase_date,
        purchase_time=purchase_time,
        amount=amount,
        description=description,
        category=category,
        confidence=confidence,
    )


def scan_finance_receipt(
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> ReceiptScanResponse:
    validate_image_file(content_type=content_type, size_bytes=len(file_bytes))
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise ReceiptValidationError(
            "Receipt scanning supports JPEG, PNG, and WebP images only"
        )

    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_openai_client()
    except OpenAINotConfiguredError as exc:
        raise ReceiptScanError("OpenAI is not configured") from exc

    encoded = base64.b64encode(file_bytes).decode("ascii")
    image_url = f"data:{content_type};base64,{encoded}"

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_VISION_MODEL,
            max_tokens=800,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": RECEIPT_SCAN_SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": build_receipt_scan_user_prompt(),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
        )
    except Exception as exc:
        logger.exception("OpenAI receipt scan failed")
        raise ReceiptScanError("Failed to scan receipt") from exc

    try:
        raw_text = response.choices[0].message.content or ""
    except (AttributeError, IndexError, TypeError) as exc:
        raise ReceiptScanError("OpenAI returned an empty response") from exc

    if not raw_text.strip():
        raise ReceiptScanError("OpenAI returned an empty response")

    payload = _extract_json_payload(raw_text)

    try:
        return _to_scan_response(payload)
    except ValidationError as exc:
        raise ReceiptScanError(
            "OpenAI response did not match receipt scan schema",
        ) from exc
