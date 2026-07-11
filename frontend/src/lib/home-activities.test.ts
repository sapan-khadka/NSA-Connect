import { describe, expect, it } from "vitest";

import {
  buildHomeActivities,
  RECENT_ACTIVITY_FOOTNOTE,
  sortHomeActivities,
  type HomeActivity,
} from "./home-activities";
import { FINANCE_APPROVALS_PATH } from "./finance-routes";

describe("home-activities", () => {
  it("places actionable rows before recent informational rows", () => {
    const activities = buildHomeActivities({
      role: "treasurer",
      tasksSummary: {
        openCount: 1,
        overdueCount: 1,
        nextTask: null,
        overdueTask: null,
      },
      pendingMembersTotal: 2,
      financePendingTotal: 1,
      myFinanceRequests: {
        pending_count: 1,
        recently_rejected_count: 1,
        recently_approved_count: 1,
      },
    });

    const kinds = activities.map((activity) => activity.kind);
    const firstRecent = kinds.indexOf("recent");
    const lastActionable = kinds.lastIndexOf("actionable");

    expect(firstRecent).toBeGreaterThan(lastActionable);
    expect(activities.at(-1)?.id).toBe("finance-my-approved");
    expect(activities.at(-2)?.id).toBe("finance-my-rejected");
    expect(
      activities.find((activity) => activity.id === "finance-pending")?.to,
    ).toBe(FINANCE_APPROVALS_PATH);
  });

  it("marks finance approved/rejected rows as recent with footnote copy available", () => {
    const activities = buildHomeActivities({
      role: "treasurer",
      tasksSummary: {
        openCount: 0,
        overdueCount: 0,
        nextTask: null,
        overdueTask: null,
      },
      pendingMembersTotal: 0,
      financePendingTotal: 0,
      myFinanceRequests: {
        pending_count: 0,
        recently_rejected_count: 1,
        recently_approved_count: 1,
      },
    });

    expect(activities).toHaveLength(2);
    expect(activities.every((activity) => activity.kind === "recent")).toBe(true);
    expect(RECENT_ACTIVITY_FOOTNOTE).toContain("7 days");
  });

  it("sorts mixed activities with actionable first", () => {
    const mixed: HomeActivity[] = [
      {
        id: "recent",
        message: "Approved",
        to: "/finance",
        actionLabel: "View",
        tone: "info",
        kind: "recent",
      },
      {
        id: "action",
        message: "Pending",
        to: "/finance",
        actionLabel: "Review",
        tone: "urgent",
        kind: "actionable",
      },
    ];

    expect(sortHomeActivities(mixed).map((activity) => activity.id)).toEqual([
      "action",
      "recent",
    ]);
  });
});
