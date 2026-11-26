"""Stable identity for a published minutes payload.

Used to avoid sending another finalized notification when a manager publishes
the same overview, decisions, and action items again.
"""

import hashlib
import json
from typing import Any


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def published_minutes_fingerprint(
    summary: str | None,
    key_decisions: list[Any] | None,
    action_items: list[Any] | None,
) -> str:
    decisions = [
        text
        for item in (key_decisions or [])
        if (text := _clean(item))
    ]
    items: list[dict[str, str | None]] = []
    for item in action_items or []:
        if not isinstance(item, dict):
            continue
        task = _clean(item.get("task"))
        if not task:
            continue
        items.append(
            {
                "task": task,
                "owner": _clean(item.get("owner")),
                "due": _clean(item.get("due")),
            }
        )
    payload = {
        "summary": (summary or "").strip(),
        "key_decisions": decisions,
        "action_items": items,
    }
    raw = json.dumps(payload, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()
