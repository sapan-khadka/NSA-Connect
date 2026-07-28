import { describe, expect, it } from "vitest";

import { buildIdeaCommunityInsight } from "./idea-community-insight";
import type { IdeaPoll } from "./event-suggestion-polish-api";
import type { EventSuggestion } from "./event-suggestions-api";

function makeIdea(
  overrides: Partial<EventSuggestion> = {},
): EventSuggestion {
  return {
    id: 1,
    title: "Test",
    description: "Desc",
    preferred_timing: null,
    status: "published",
    suggested_by: { id: 1, full_name: "Alex" },
    noted_by: null,
    created_at: "2026-07-01T00:00:00Z",
    noted_at: null,
    board_note: null,
    can_board_review: true,
    converted_event_id: null,
    published_at: "2026-07-01T00:00:00Z",
    community_interest_enabled: true,
    community_discussion_enabled: false,
    community_visibility: "members",
    community_feedback_closed_at: null,
    view_count: 0,
    interest_counts: {
      interested: 20,
      maybe: 3,
      not_interested: 0,
    },
    my_interest: null,
    poll_count: 2,
    open_poll_count: 0,
    poll_vote_count: 20,
    eligible_member_count: 48,
    ...overrides,
  };
}

function makePoll(overrides: Partial<IdeaPoll> = {}): IdeaPoll {
  return {
    id: 10,
    suggestion_id: 1,
    question: "Preferred day?",
    is_open: false,
    created_at: "2026-07-02T00:00:00Z",
    created_by: { id: 1, full_name: "Alex" },
    my_option_id: null,
    total_votes: 18,
    options: [
      { id: 1, label: "Friday evening", sort_order: 0, vote_count: 12 },
      { id: 2, label: "Saturday", sort_order: 1, vote_count: 6 },
    ],
    ...overrides,
  };
}

describe("buildIdeaCommunityInsight", () => {
  it("writes qualitative board-facing narrative", () => {
    const insight = buildIdeaCommunityInsight(makeIdea(), [
      makePoll(),
      makePoll({
        id: 11,
        question: "Transportation?",
        options: [
          { id: 3, label: "University Shuttle", sort_order: 0, vote_count: 11 },
          { id: 4, label: "Own car", sort_order: 1, vote_count: 7 },
        ],
        total_votes: 18,
      }),
    ]);

    expect(insight.responseCount).toBe(23);
    expect(insight.insights).toContain("Most respondents support the event.");
    expect(insight.insights).toContain("Friday evening is the preferred time.");
    expect(insight.insights).toContain(
      "Many members requested University Shuttle.",
    );
    expect(insight.insights).toContain("No significant concerns were raised.");
    expect(insight.insights.join(" ")).not.toMatch(/\d+ comments/);
  });

  it("stays qualitative when feedback is thin", () => {
    const insight = buildIdeaCommunityInsight(
      makeIdea({
        interest_counts: {
          interested: 1,
          maybe: 0,
          not_interested: 0,
        },
      }),
      [
        makePoll({
          is_open: true,
          total_votes: 0,
          options: [
            { id: 1, label: "Friday", sort_order: 0, vote_count: 0 },
            { id: 2, label: "Saturday", sort_order: 1, vote_count: 0 },
          ],
        }),
      ],
      ["Please avoid scheduling during finals week."],
    );

    expect(insight.insights).toContain("Early feedback is still limited.");
    expect(insight.insights).toContain("Timing preference is still unclear.");
    expect(insight.insights.some((line) => line.startsWith("One concern mentioned:"))).toBe(
      true,
    );
    expect(insight.insights.join(" ")).not.toMatch(/Only 1 member/);
  });
});
