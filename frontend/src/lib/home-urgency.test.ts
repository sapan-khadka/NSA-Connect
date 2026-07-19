import { describe, expect, it } from "vitest";

import { createMockEventResponse } from "../test/test-utils";
import { buildHomeUrgencyLine } from "./home-urgency";

describe("buildHomeUrgencyLine", () => {
  it("prioritizes overdue tasks", () => {
    expect(
      buildHomeUrgencyLine({
        overdueCount: 2,
        dueTodayCount: 1,
        pendingReviewCount: 3,
        nextEvent: createMockEventResponse(),
      }),
    ).toBe("2 overdue tasks need attention.");
  });

  it("falls back to reviews, then due today, then next event", () => {
    expect(
      buildHomeUrgencyLine({
        overdueCount: 0,
        dueTodayCount: 0,
        pendingReviewCount: 1,
        nextEvent: createMockEventResponse(),
      }),
    ).toBe("1 review waiting for you.");

    expect(
      buildHomeUrgencyLine({
        overdueCount: 0,
        dueTodayCount: 3,
        pendingReviewCount: 0,
        nextEvent: createMockEventResponse(),
      }),
    ).toBe("3 tasks due today.");

    expect(
      buildHomeUrgencyLine({
        overdueCount: 0,
        dueTodayCount: 0,
        pendingReviewCount: 0,
        nextEvent: createMockEventResponse({
          name: "Dashain Celebration",
          starts_at: "2030-06-20T18:00:00+00:00",
        }),
      }),
    ).toMatch(/Dashain Celebration/);
  });

  it("shows a clear state when nothing is urgent", () => {
    expect(
      buildHomeUrgencyLine({
        overdueCount: 0,
        dueTodayCount: 0,
        pendingReviewCount: 0,
        nextEvent: null,
      }),
    ).toBe("You're clear — nothing urgent right now.");
  });
});
