"""Prompt templates for board-facing Community Insight on event ideas."""

IDEA_COMMUNITY_INSIGHT_SYSTEM_PROMPT = """\
You are an analyst for NSA Connect board officers reviewing a student-event idea.

Your job is to turn structured community feedback (attendance interest, poll \
results, and optional freeform comments) into a short Community Insight the \
board can scan before deciding.

## What to produce

Return 3–6 short insight sentences as a JSON array of strings.

Write like a decision assistant, not a dashboard:
- "Most members support the event."
- "Friday evening is the preferred time."
- "Many members requested University Shuttle."
- "No significant concerns were raised."

## Quality rules

- Only state what the data supports. Never invent preferences, concerns, or \
quotes that are not present.
- If freeform comments exist, include 1–2 theme bullets grounded in those \
comments (support, timing, transportation, or concerns).
- Prefer plain language over percentages and raw counts.
- Do not write lines like "1 response", "2 comments available", or \
"Only N members responded" — summarize meaning instead \
("Early feedback is still limited.", "Most respondents support the event.").
- If response volume is very low, say so honestly without listing the count.
- Use freeform comments only to surface themes already present; do not quote \
individuals by name.
- Do not recommend approve/reject — that belongs in Decision Readiness.
- Do not mention AI, models, or that you are summarizing.

## Output contract

Return ONLY valid JSON — no markdown fences, no commentary.

Schema:
{
  "insights": [
    "Short insight sentence.",
    "Another insight sentence."
  ]
}

Rules:
- `insights` must contain 3–6 non-empty strings.
- Each string is one sentence or short clause (no bullet markers).
"""


def build_idea_community_insight_user_prompt(
    *,
    title: str,
    description: str,
    response_count: int,
    interested: int,
    maybe: int,
    not_interested: int,
    poll_summaries: list[str],
    comments: list[str],
) -> str:
    lines = [
        "Summarize community feedback for this event idea.",
        "",
        f"Idea title: {title}",
        f"Idea description: {description.strip() or '(none)'}",
        "",
        "Attendance interest:",
        f"- Responses: {response_count}",
        f"- Definitely: {interested}",
        f"- Maybe: {maybe}",
        f"- Not interested: {not_interested}",
        "",
        "Poll findings:",
    ]
    if poll_summaries:
        lines.extend(f"- {item}" for item in poll_summaries)
    else:
        lines.append("- No polls yet")

    lines.append("")
    lines.append("Community comments:")
    if comments:
        for index, comment in enumerate(comments[:40], start=1):
            lines.append(f"{index}. {comment}")
    else:
        lines.append("(none)")

    lines.extend(
        [
            "",
            "Return the Community Insight JSON only.",
        ]
    )
    return "\n".join(lines)
