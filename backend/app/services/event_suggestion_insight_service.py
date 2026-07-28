"""Community Insight for idea board review — rules first, optional AI."""

from __future__ import annotations

import json
import logging
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.models.event_suggestion_comment import EventSuggestionCommentChannel
from app.models.member import Member
from app.prompts.idea_community_insight import (
    IDEA_COMMUNITY_INSIGHT_SYSTEM_PROMPT,
    build_idea_community_insight_user_prompt,
)
from app.schemas.event_suggestion import (
    EventSuggestionCommunityInsightResponse,
    EventSuggestionInterestCounts,
    EventSuggestionPollResponse,
)
from app.services.ai_checklist_service import AIDisabledError
from app.services.event_suggestion_comment_service import (
    list_event_suggestion_comments,
)
from app.services.event_suggestion_polish_service import list_event_suggestion_polls
from app.services.event_suggestion_service import (
    get_event_suggestion,
    get_interest_counts_by_suggestion,
)

logger = logging.getLogger(__name__)

_JSON_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
InsightSource = Literal["rules", "ai"]


class AIIdeaCommunityInsightError(Exception):
    pass


class _AIInsightPayload(BaseModel):
    insights: list[str] = Field(min_length=1, max_length=8)

    def cleaned(self) -> list[str]:
        lines: list[str] = []
        for item in self.insights:
            text = item.strip()
            if text:
                lines.append(text)
        return lines[:6]


def _total_responses(counts: EventSuggestionInterestCounts) -> int:
    return counts.interested + counts.maybe + counts.not_interested


def _would_attend_percent(counts: EventSuggestionInterestCounts) -> int | None:
    total = _total_responses(counts)
    if total == 0:
        return None
    return round(((counts.interested + counts.maybe) / total) * 100)


def _definitely_percent(counts: EventSuggestionInterestCounts) -> int | None:
    total = _total_responses(counts)
    if total == 0:
        return None
    return round((counts.interested / total) * 100)


def _not_interested_percent(counts: EventSuggestionInterestCounts) -> int | None:
    total = _total_responses(counts)
    if total == 0:
        return None
    return round((counts.not_interested / total) * 100)


def _preference_kind(question: str) -> str:
    q = question.lower()
    if "semester" in q:
        return "semester"
    if "transport" in q:
        return "transport"
    if any(token in q for token in ("date", "day", "when", "time")):
        return "timing"
    if "budget" in q or "contribution" in q:
        return "budget"
    if "volunteer" in q:
        return "volunteer"
    return "other"


def _winning_option(
    poll: EventSuggestionPollResponse,
) -> tuple[str, int, bool] | None:
    if poll.total_votes <= 0 or not poll.options:
        return None
    max_votes = max(option.vote_count for option in poll.options)
    leaders = [option for option in poll.options if option.vote_count == max_votes]
    share = round((max_votes / poll.total_votes) * 100)
    if len(leaders) > 1:
        label = " / ".join(option.label for option in leaders)
        return label, share, True
    return leaders[0].label, share, False


def _poll_preference_line(poll: EventSuggestionPollResponse) -> str | None:
    winner = _winning_option(poll)
    kind = _preference_kind(poll.question)
    if winner is None:
        if kind == "timing":
            return "Timing preference is still unclear."
        if kind == "transport":
            return "Transportation preference is still unclear."
        if kind == "semester":
            return "Semester preference is still unclear."
        return None

    label, share, tied = winner
    if tied or share < 45:
        if kind == "timing":
            return "Members seem flexible about timing."
        if kind == "transport":
            return "Transportation preference is still unclear."
        if kind == "semester":
            return "Members seem flexible about semester."
        return f"Preference is still unclear for {poll.question.rstrip('?')}."

    if kind == "timing":
        return f"{label} is the preferred time."
    if kind == "transport":
        return f"Many members requested {label}."
    if kind == "semester":
        return f"{label} is the preferred semester."
    if kind == "budget":
        return f"Preferred budget option is {label}."
    if kind == "volunteer":
        return f"Volunteer interest leans toward {label}."
    return f"Members prefer {label}."


_CONCERN_HINTS = (
    "avoid",
    "concern",
    "final",
    "conflict",
    "issue",
    "worry",
    "don't",
    "dont",
    "cannot",
    "can't",
    "too late",
    "busy",
)


def _truncate_concern(text: str, max_len: int = 72) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[: max_len - 1].rstrip()}…"


def _concern_insight(comments: list[str]) -> str | None:
    for comment in comments:
        lower = comment.lower()
        if any(hint in lower for hint in _CONCERN_HINTS):
            return f"One concern mentioned: {_truncate_concern(comment)}"
    return None


def _comment_theme_insights(comments: list[str]) -> list[str]:
    if not comments:
        return []
    lines: list[str] = []
    concern = _concern_insight(comments)
    support_hits = 0
    transport_hits = 0
    timing_hits = 0
    for comment in comments:
        lower = comment.lower()
        if any(
            token in lower
            for token in ("love", "great", "fun", "excited", "support", "works")
        ):
            support_hits += 1
        if any(
            token in lower
            for token in ("shuttle", "transport", "bus", "ride", "parking")
        ):
            transport_hits += 1
        if any(
            token in lower
            for token in ("weekend", "friday", "saturday", "evening", "afternoon", "morning")
        ):
            timing_hits += 1

    if support_hits >= max(1, len(comments) // 3):
        lines.append("Comment themes lean supportive.")
    if transport_hits > 0:
        lines.append("Transportation came up in member comments.")
    if timing_hits > 0:
        lines.append("Timing preferences were mentioned in comments.")
    if concern:
        lines.append(concern)
    elif len(comments) >= 2 and not any(
        hint in " ".join(comments).lower() for hint in _CONCERN_HINTS
    ):
        lines.append("No significant concerns were raised in comments.")
    return lines[:3]


def build_rule_based_community_insights(
    *,
    counts: EventSuggestionInterestCounts,
    polls: list[EventSuggestionPollResponse],
    comment_count: int = 0,
    comments: list[str] | None = None,
) -> list[str]:
    """Deterministic Community Insight lines for board review."""
    del comment_count  # kept for call-site compatibility; avoid raw counts in copy
    live_comments = comments or []
    responses = _total_responses(counts)
    attend = _would_attend_percent(counts)
    definitely = _definitely_percent(counts)
    opposed = _not_interested_percent(counts)
    open_polls = sum(1 for poll in polls if poll.is_open)
    voted_polls = [poll for poll in polls if poll.total_votes > 0]
    unvoted_open = [poll for poll in polls if poll.is_open and poll.total_votes == 0]

    insights: list[str] = []

    if responses == 0 and not live_comments:
        insights.append("Waiting for community responses.")
        if open_polls > 0:
            insights.append("Scheduling preferences are not clear yet.")
        return insights

    if responses == 0 and live_comments:
        insights.append("Members left comments before attendance responses.")
    elif responses < 5:
        insights.append("Early feedback is still limited.")

    if attend is not None and definitely is not None and responses >= 5:
        if attend >= 80 and definitely >= 60:
            insights.append("Most respondents support the event.")
        elif attend >= 65:
            insights.append("Members show solid interest in attending.")
        elif attend >= 45:
            insights.append("Attendance interest is mixed so far.")
        else:
            insights.append("Attendance interest is weak so far.")
    elif attend is not None and responses >= 1 and attend >= 80:
        insights.append("Early respondents support the event.")

    preference_lines: list[str] = []
    seen_prefs: set[str] = set()
    for poll in [*voted_polls, *unvoted_open]:
        line = _poll_preference_line(poll)
        if line and line not in seen_prefs:
            seen_prefs.add(line)
            preference_lines.append(line)
        if len(preference_lines) >= 3:
            break
    insights.extend(preference_lines)

    if open_polls > 0 and not voted_polls and not preference_lines:
        insights.append("No scheduling preference yet.")

    theme_lines = _comment_theme_insights(live_comments)
    if theme_lines:
        insights.extend(theme_lines)
    elif opposed is not None:
        if opposed >= 30:
            insights.append("Some members indicated they would not attend.")
        elif opposed < 15 and responses >= 3:
            insights.append("No significant concerns were raised.")

    seen: set[str] = set()
    unique: list[str] = []
    for line in insights:
        if line not in seen:
            seen.add(line)
            unique.append(line)
    return unique[:6]


def _poll_summary_for_ai(poll: EventSuggestionPollResponse) -> str:
    winner = _winning_option(poll)
    status = "open" if poll.is_open else "closed"
    if winner is None:
        return f"{poll.question} ({status}, {poll.total_votes} votes): no winner yet"
    label, share, tied = winner
    tie = "tied " if tied else ""
    return (
        f"{poll.question} ({status}, {poll.total_votes} votes): "
        f"{tie}{label} ({share}%)"
    )


def _extract_json_payload(raw_text: str) -> dict:
    cleaned = _JSON_FENCE_PATTERN.sub("", raw_text.strip())
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIIdeaCommunityInsightError("Anthropic returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise AIIdeaCommunityInsightError("Anthropic response must be a JSON object")
    return payload


def generate_ai_community_insights(
    *,
    title: str,
    description: str,
    counts: EventSuggestionInterestCounts,
    polls: list[EventSuggestionPollResponse],
    comments: list[str],
) -> list[str]:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIIdeaCommunityInsightError("Anthropic is not configured") from exc

    response_count = _total_responses(counts)
    try:
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=IDEA_COMMUNITY_INSIGHT_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": build_idea_community_insight_user_prompt(
                        title=title,
                        description=description,
                        response_count=response_count,
                        interested=counts.interested,
                        maybe=counts.maybe,
                        not_interested=counts.not_interested,
                        poll_summaries=[_poll_summary_for_ai(poll) for poll in polls],
                        comments=comments,
                    ),
                }
            ],
        )
    except Exception as exc:
        logger.exception("Anthropic community insight failed for idea=%s", title)
        raise AIIdeaCommunityInsightError("Failed to generate community insight") from exc

    text_blocks = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text" and block.text.strip()
    ]
    if not text_blocks:
        raise AIIdeaCommunityInsightError("Anthropic returned an empty response")

    payload = _extract_json_payload(text_blocks[0])
    try:
        parsed = _AIInsightPayload.model_validate(payload)
    except ValidationError as exc:
        raise AIIdeaCommunityInsightError(
            "Anthropic response did not match insight schema",
        ) from exc

    cleaned = parsed.cleaned()
    if len(cleaned) < 2:
        raise AIIdeaCommunityInsightError("Anthropic returned too few insights")
    return cleaned


def get_event_suggestion_community_insight(
    db: Session,
    *,
    suggestion_id: int,
    member: Member,
) -> EventSuggestionCommunityInsightResponse:
    suggestion = get_event_suggestion(db, suggestion_id=suggestion_id, member=member)
    counts_map = get_interest_counts_by_suggestion(db, suggestion_ids=[suggestion_id])
    counts = counts_map.get(suggestion_id) or EventSuggestionInterestCounts()
    polls = list_event_suggestion_polls(
        db,
        suggestion_id=suggestion_id,
        member=member,
    )

    comment_rows = list_event_suggestion_comments(
        db,
        suggestion_id=suggestion_id,
        member=member,
        channel=EventSuggestionCommentChannel.COMMUNITY,
    )
    live_comments = [
        comment.content.strip()
        for comment in comment_rows
        if comment.deleted_at is None and comment.content and comment.content.strip()
    ]

    rule_insights = build_rule_based_community_insights(
        counts=counts,
        polls=polls,
        comments=live_comments,
    )

    source: InsightSource = "rules"
    insights = rule_insights
    settings = get_settings()
    if settings.AI_ENABLED:
        try:
            insights = generate_ai_community_insights(
                title=suggestion.title,
                description=suggestion.description or "",
                counts=counts,
                polls=polls,
                comments=live_comments,
            )
            source = "ai"
        except AIDisabledError:
            insights = rule_insights
            source = "rules"
        except AIIdeaCommunityInsightError:
            logger.warning(
                "AI community insight unavailable for suggestion=%s; using rules",
                suggestion_id,
                exc_info=True,
            )
            insights = rule_insights
            source = "rules"
        except Exception:
            logger.exception(
                "Unexpected AI community insight failure for suggestion=%s",
                suggestion_id,
            )
            insights = rule_insights
            source = "rules"

    return EventSuggestionCommunityInsightResponse(
        response_count=_total_responses(counts),
        insights=insights,
        source=source,
        comment_count=len(live_comments),
    )
