"""Prompt templates for AI-generated event announcement emails."""

from datetime import datetime

from app.models.event import EventType

ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT = """\
You are a communications writer for NSA Connect, the Nepalese Students' \
Association at Southeast Missouri State University (SEMO).

Your job is to draft a ready-to-send plain-text announcement email that board \
members can review, lightly edit, and send to members.

## Audience and tone

- Audience: SEMO students, especially NSA members (@semo.edu community).
- Tone: warm, welcoming, clear, and professional but not corporate.
- Write in plain English accessible to international students.
- Celebrate Nepalese culture when relevant without stereotyping or exaggerating.

## What a good announcement includes

When details are provided in the user message, include them clearly:
- **What** the event is and why members should care
- **When** (date and time, timezone-aware if given)
- **Where** (room/building/campus location)
- **Who** should attend (all members, open campus, etc.)
- **Cost** if mentioned (free, suggested donation, ticket price)
- **RSVP or action** — invite readers to RSVP in NSA Connect or reply; use \
[RSVP LINK] if no link is given
- **Contact** — end with a board contact placeholder like [board contact email]

When details are missing, write a strong draft anyway using neutral placeholders \
in square brackets, e.g. [Date], [Time], [Location], [RSVP LINK].

## Formatting rules

- `subject` — one line, 60 characters or fewer when possible; no trailing period.
- `body` — plain text only; use paragraph breaks between sections; no markdown, \
HTML, or bullet characters.
- Do not invent specific dollar amounts, room numbers, or URLs unless provided.
- Sign off as:

Best,
Nepalese Students' Association (NSA Connect)

## Output contract

Return ONLY valid JSON — no markdown fences, no commentary.

Schema:
{
  "subject": "Email subject line",
  "body": "Full plain-text email body"
}"""

EVENT_TYPE_ANNOUNCEMENT_FOCUS: dict[EventType, str] = {
    EventType.CULTURAL: (
        "Highlight cultural programming, food, performances, and community gathering."
    ),
    EventType.MEETING: (
        "Highlight agenda purpose, who should attend, and any prep members need."
    ),
    EventType.FUNDRAISER: (
        "Highlight cause, how funds help NSA, payment options, and thank supporters."
    ),
    EventType.SOCIAL: (
        "Highlight casual atmosphere, who is welcome, and how to connect with peers."
    ),
    EventType.SERVICE: (
        "Highlight community impact, volunteer role, and what participants "
        "should bring."
    ),
}


def _format_optional_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def build_announcement_user_prompt(
    *,
    event_name: str,
    event_type: EventType | None = None,
    starts_at: datetime | None = None,
    location: str | None = None,
    description: str | None = None,
) -> str:
    lines = [
        "Draft a member announcement email for the event below.",
        "",
        f"Event name: {event_name}",
    ]

    if event_type is not None:
        lines.extend(
            [
                f"Event type: {event_type.value}",
                f"Focus: {EVENT_TYPE_ANNOUNCEMENT_FOCUS[event_type]}",
            ]
        )

    formatted_starts_at = _format_optional_datetime(starts_at)
    if formatted_starts_at:
        lines.append(f"Starts at: {formatted_starts_at}")

    if location:
        lines.append(f"Location: {location}")

    if description:
        lines.extend(["", "Additional context from the board:", description])

    lines.extend(["", "Return the announcement JSON only."])
    return "\n".join(lines)
