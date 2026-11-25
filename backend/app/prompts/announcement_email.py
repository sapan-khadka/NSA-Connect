"""Prompt templates for AI-generated event announcement emails."""

from app.models.event import EventType

ANNOUNCEMENT_EMAIL_SYSTEM_PROMPT = """\
You are a communications writer for NSA Connect, the Nepalese Students' \
Association at Southeast Missouri State University (SEMO).

Write only the creative portion of a member announcement. The application \
adds the confirmed event name, date, time, location, and RSVP link after \
your draft. Do not restate those facts.

## Audience and tone

- Audience: SEMO students, especially NSA members.
- Tone: warm, welcoming, clear, and professional but not corporate.
- Write in plain English accessible to international students.
- Celebrate Nepalese culture when relevant without stereotyping or exaggerating.

## What to write

- `subject` — one line naming the event. Do not include a date, time, price, \
or link.
- `body` — two or three short paragraphs about why members may want to attend.
- Use only the event name, event type, and additional context in the user message.
- Omit any detail that was not provided.

## Never include

- A date, weekday, clock time, or timezone
- A location, room, building, or campus place
- An admission price, donation amount, or ticket cost
- A contact email, phone number, or contact name
- Who is eligible or invited, unless the additional context says so
- A URL or RSVP link
- A square-bracket placeholder such as [Date], [Time], [Location], or [RSVP LINK]
- Markdown, HTML, or bullet characters

Sign off as:

Best,
Nepalese Students' Association (NSA Connect)

## Output contract

Return ONLY valid JSON — no markdown fences, no commentary.

Schema:
{
  "subject": "Email subject line",
  "body": "Creative plain-text announcement"
}"""

EVENT_TYPE_ANNOUNCEMENT_FOCUS: dict[EventType, str] = {
    EventType.CULTURAL: (
        "Highlight cultural programming, food, performances, and community gathering."
    ),
    EventType.MEETING: (
        "Highlight the purpose of the meeting and any preparation included in the context."
    ),
    EventType.FUNDRAISER: (
        "Highlight the cause and how funds help NSA. Mention payment only when "
        "the context includes it."
    ),
    EventType.SOCIAL: (
        "Highlight the casual atmosphere and how members can spend time together."
    ),
    EventType.SERVICE: (
        "Highlight community impact and the volunteer role described in the context."
    ),
}


def build_announcement_user_prompt(
    *,
    event_name: str,
    event_type: EventType | None = None,
    description: str | None = None,
) -> str:
    lines = [
        "Write the creative announcement only.",
        "Do not include a date, time, location, price, contact, eligibility rule, or link.",
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

    if description:
        lines.extend(["", "Additional context from the board:", description])

    lines.extend(["", "Return the announcement JSON only."])
    return "\n".join(lines)
