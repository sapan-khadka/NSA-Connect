from datetime import UTC, datetime

import pytest

from app.schemas.event_suggestion import (
    EventSuggestionInterestCounts,
    EventSuggestionMemberResponse,
    EventSuggestionPollOptionResponse,
    EventSuggestionPollResponse,
)
from app.services.ai_checklist_service import AIDisabledError
from app.services.event_suggestion_insight_service import (
    build_rule_based_community_insights,
    generate_ai_community_insights,
)
from tests.helpers.anthropic_mocks import mock_claude_json_api

INSIGHT_SETTINGS = "app.services.event_suggestion_insight_service.get_settings"
INSIGHT_CLIENT = "app.services.event_suggestion_insight_service.get_anthropic_client"


def _member() -> EventSuggestionMemberResponse:
    return EventSuggestionMemberResponse(id=1, full_name="Alex", position=None)


def _poll(
    *,
    question: str,
    options: list[tuple[str, int]],
    is_open: bool = False,
    poll_id: int = 1,
) -> EventSuggestionPollResponse:
    total = sum(votes for _, votes in options)
    return EventSuggestionPollResponse(
        id=poll_id,
        suggestion_id=1,
        question=question,
        is_open=is_open,
        created_at=datetime(2026, 7, 2, tzinfo=UTC),
        created_by=_member(),
        my_option_id=None,
        total_votes=total,
        options=[
            EventSuggestionPollOptionResponse(
                id=index,
                label=label,
                sort_order=index,
                vote_count=votes,
            )
            for index, (label, votes) in enumerate(options, start=1)
        ],
    )


def test_rule_based_insight_reads_like_decision_support():
    insights = build_rule_based_community_insights(
        counts=EventSuggestionInterestCounts(
            interested=20,
            maybe=3,
            not_interested=0,
        ),
        polls=[
            _poll(
                question="Preferred day?",
                options=[("Friday evening", 12), ("Saturday", 6)],
            ),
            _poll(
                question="Transportation?",
                options=[("University Shuttle", 11), ("Own car", 7)],
                poll_id=2,
            ),
        ],
    )

    assert "Most respondents support the event." in insights
    assert "Friday evening is the preferred time." in insights
    assert "Many members requested University Shuttle." in insights
    assert "No significant concerns were raised." in insights


def test_rule_based_insight_when_feedback_is_thin():
    insights = build_rule_based_community_insights(
        counts=EventSuggestionInterestCounts(
            interested=1,
            maybe=0,
            not_interested=0,
        ),
        polls=[
            _poll(
                question="Preferred day?",
                options=[("Friday", 0), ("Saturday", 0)],
                is_open=True,
            ),
        ],
        comments=["Please avoid scheduling during finals week."],
    )

    assert "Early feedback is still limited." in insights
    assert "Timing preference is still unclear." in insights
    assert any(line.startswith("One concern mentioned:") for line in insights)
    assert not any("Only 1 member" in line for line in insights)


def test_generate_ai_community_insights_uses_anthropic():
    payload = {
        "insights": [
            "Most members support the event.",
            "Friday evening is the preferred time.",
            "No significant concerns were raised.",
        ]
    }
    with mock_claude_json_api(
        settings_patch=INSIGHT_SETTINGS,
        client_patch=INSIGHT_CLIENT,
        payload=payload,
    ) as mock_client:
        insights = generate_ai_community_insights(
            title="Holi celebration",
            description="Campus color festival",
            counts=EventSuggestionInterestCounts(
                interested=20,
                maybe=3,
                not_interested=0,
            ),
            polls=[],
            comments=["Please use the shuttle if possible."],
        )

    assert insights[0] == "Most members support the event."
    mock_client.messages.create.assert_called_once()


def test_generate_ai_community_insights_raises_when_disabled():
    with mock_claude_json_api(
        settings_patch=INSIGHT_SETTINGS,
        client_patch=INSIGHT_CLIENT,
        payload={"insights": ["x", "y"]},
        ai_enabled=False,
    ):
        with pytest.raises(AIDisabledError):
            generate_ai_community_insights(
                title="Holi",
                description="",
                counts=EventSuggestionInterestCounts(),
                polls=[],
                comments=[],
            )
