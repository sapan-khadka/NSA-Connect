import { describe, expect, it } from "vitest";

import { computeEventReadiness } from "./event-readiness";
import { createMockEventDetailResponse } from "../test/test-utils";

describe("computeEventReadiness", () => {
  it("scores a fully prepared upcoming event highly", () => {
    const result = computeEventReadiness({
      event: createMockEventDetailResponse({
        event_photo_url: "https://example.com/cover.jpg",
        location: "University Center",
        capacity: 120,
        budget: "500.00",
        is_past: false,
      }),
      budget: {
        event_id: 1,
        event_name: "Dashain",
        planned_budget: "500.00",
        actual_expense: "0",
        actual_income: "0",
        budget_remaining: "500.00",
        over_budget: false,
        entry_count: 0,
      },
      volunteerCount: 3,
      volunteerNeeded: 3,
    });

    expect(result.scorePercent).toBeGreaterThanOrEqual(80);
    expect(result.checks.find((c) => c.id === "cover")?.status).toBe("pass");
    expect(result.checks.find((c) => c.id === "volunteers")?.status).toBe(
      "pass",
    );
    expect(result.checks.find((c) => c.id === "capacity")?.status).toBe("pass");
    expect(result.checks.find((c) => c.id === "reminder")).toBeUndefined();
  });

  it("suggests adding roles when no volunteer targets are set", () => {
    const result = computeEventReadiness({
      event: createMockEventDetailResponse({
        event_photo_url: "https://example.com/cover.jpg",
        location: "Hall",
        capacity: 50,
        budget: "500.00",
      }),
      budget: {
        event_id: 1,
        event_name: "Dashain",
        planned_budget: "500.00",
        actual_expense: "0",
        actual_income: "0",
        budget_remaining: "500.00",
        over_budget: false,
        entry_count: 0,
      },
      volunteerCount: 0,
      volunteerNeeded: 0,
    });

    expect(result.checks.find((c) => c.id === "volunteers")?.status).toBe(
      "warn",
    );
    expect(result.suggestedNextStep).toMatch(/role/i);
    expect(result.resolveTarget).toBe("volunteers");
  });

  it("warns when configured volunteer spots are unfilled", () => {
    const result = computeEventReadiness({
      event: createMockEventDetailResponse({
        event_photo_url: "https://example.com/cover.jpg",
        location: "Hall",
        capacity: 50,
        budget: "500.00",
      }),
      budget: {
        event_id: 1,
        event_name: "Dashain",
        planned_budget: "500.00",
        actual_expense: "0",
        actual_income: "0",
        budget_remaining: "500.00",
        over_budget: false,
        entry_count: 0,
      },
      volunteerCount: 1,
      volunteerNeeded: 4,
    });

    expect(result.checks.find((c) => c.id === "volunteers")?.status).toBe(
      "warn",
    );
    expect(result.suggestedNextStep).toMatch(/3 more volunteer/i);
  });

  it("flags a missing cover as a failure", () => {
    const result = computeEventReadiness({
      event: createMockEventDetailResponse({ event_photo_url: null }),
      budget: null,
      volunteerCount: 1,
    });

    expect(result.checks.find((c) => c.id === "cover")?.status).toBe("fail");
    expect(result.suggestedNextStep).toMatch(/cover/i);
    expect(result.resolveTarget).toBe("cover");
  });
});
