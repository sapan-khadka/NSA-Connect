"""Assemble an announcement from model prose and confirmed event facts.

The model writes the invitation. Dates, times, location, and the RSVP link
are inserted here so they do not depend on the model copying them correctly.
"""

import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.lib.event_timezone import format_event_moment

_PLACEHOLDER = re.compile(r"\[[^\]\n]{1,80}\]")
_LABELED_FACT = re.compile(
    r"^\s*(when|where|ends|end time|start time|date|time|admission|cost|"
    r"price|ticket|tickets|contact|email|rsvp|who|eligibility|audience)\s*[:\-]",
    re.IGNORECASE,
)
_ELIGIBILITY = re.compile(
    r"^\s*(open to|who should|eligibility|members only|all students)\b",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_MONEY = re.compile(r"\$\s*\d")
_URL = re.compile(r"https?://", re.IGNORECASE)
_SCHEDULE_WORD = re.compile(
    r"\b("
    r"monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"january|february|march|april|june|july|august|september|"
    r"october|november|december|"
    r"\d{1,2}:\d{2}"
    r")\b",
    re.IGNORECASE,
)
_MAY_MONTH = re.compile(r"\bMay\b")


def build_confirmed_event_details(
    *,
    event_name: str,
    starts_at: datetime | None,
    ends_at: datetime | None,
    location: str | None,
    event_url: str | None,
    timezone: ZoneInfo,
) -> str:
    """Return the facts block. Missing facts are left out, not replaced."""
    lines = [event_name.strip()]
    if starts_at is not None:
        lines.append(f"When: {format_event_moment(starts_at, timezone)}")
    if ends_at is not None:
        lines.append(f"Ends: {format_event_moment(ends_at, timezone)}")
    cleaned_location = (location or "").strip()
    if cleaned_location:
        lines.append(f"Where: {cleaned_location}")
    cleaned_url = (event_url or "").strip()
    if cleaned_url:
        lines.append(f"RSVP: {cleaned_url}")
    if len(lines) == 1:
        return ""
    return "\n".join(lines)


def compose_announcement_draft(
    *,
    event_name: str,
    creative_subject: str,
    creative_body: str,
    starts_at: datetime | None,
    ends_at: datetime | None,
    location: str | None,
    event_url: str | None,
    timezone: ZoneInfo,
) -> tuple[str, str]:
    facts = build_confirmed_event_details(
        event_name=event_name,
        starts_at=starts_at,
        ends_at=ends_at,
        location=location,
        event_url=event_url,
        timezone=timezone,
    )
    subject = _clean_subject(creative_subject, event_name)
    creative = _clean_creative_body(creative_body)
    parts = [part for part in (creative, facts) if part]
    body = "\n\n".join(parts).strip() or facts or event_name.strip()
    return subject, body


def _clean_subject(subject: str, event_name: str) -> str:
    cleaned = _PLACEHOLDER.sub("", subject).strip()
    if not cleaned or _line_is_untrusted(cleaned):
        return event_name.strip()
    return cleaned


def _clean_creative_body(body: str) -> str:
    kept: list[str] = []
    previous_blank = False
    for raw_line in body.splitlines():
        line = _PLACEHOLDER.sub("", raw_line).strip()
        if not line:
            if kept and not previous_blank:
                kept.append("")
            previous_blank = True
            continue
        if _line_is_untrusted(line):
            continue
        kept.append(line)
        previous_blank = False
    while kept and kept[-1] == "":
        kept.pop()
    return "\n".join(kept).strip()


def _line_is_untrusted(line: str) -> bool:
    if _LABELED_FACT.match(line) or _ELIGIBILITY.match(line):
        return True
    if _EMAIL.search(line) or _MONEY.search(line) or _URL.search(line):
        return True
    if _SCHEDULE_WORD.search(line) or _MAY_MONTH.search(line):
        return True
    return False
