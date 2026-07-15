import { describe, expect, it } from "vitest";

import type { EventTaskResponse } from "./event-tasks-api";
import type { FinancialStatusSummary } from "./member-workspace-financial";
import {
  buildMemberWorkspaceInsights,
  countTasksInLastDays,
  findTaskOverdueByDays,
} from "./member-workspace-insights";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function task(
  overrides: Partial<EventTaskResponse> & Pick<EventTaskResponse, "id" | "title">,
): EventTaskResponse {
  return {
    event_id: 1,
    event_name: "Event",
    task_kind: "simple",
    group_name: null,
    description: "",
    assignee_id: 2,
    assignee_name: "Alex",
    status: "todo",
    due_date: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function unpaidFinancial(amount: number): FinancialStatusSummary {
  return {
    hasHistory: true,
    currentSemester: "2026-spring",
    currentStatus: "unpaid",
    currentStatusLabel: "Outstanding",
    currentTone: "outstanding",
    outstandingAmount: amount,
    outstandingLabel: `Outstanding: $${amount}`,
    lifetimeContributions: 0,
    lifetimeLabel: "$0.00",
  };
}

describe("member-workspace-insights", () => {
  it("emits missed meetings only at 3+", () => {
    expect(
      buildMemberWorkspaceInsights({
        consecutiveMissedMeetings: 2,
        financialSummary: null,
        tasks: [],
        now: NOW,
      }),
    ).toHaveLength(0);

    const insights = buildMemberWorkspaceInsights({
      consecutiveMissedMeetings: 4,
      financialSummary: null,
      tasks: [],
      now: NOW,
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].message).toBe("Hasn't attended the last 4 meetings.");
  });

  it("states outstanding dues without eligibility claims", () => {
    const insights = buildMemberWorkspaceInsights({
      consecutiveMissedMeetings: null,
      financialSummary: unpaidFinancial(20),
      tasks: [],
      now: NOW,
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].message).toBe("Outstanding dues ($20.00).");
    expect(insights[0].message.toLowerCase()).not.toContain("eligib");
  });

  it("requires min 3 assigned tasks in 90 days for high completion", () => {
    const twoDone = [
      task({
        id: 1,
        title: "A",
        status: "done",
        is_complete: true,
        created_at: "2026-06-01T00:00:00.000Z",
      }),
      task({
        id: 2,
        title: "B",
        status: "done",
        is_complete: true,
        created_at: "2026-06-15T00:00:00.000Z",
      }),
    ];
    expect(
      buildMemberWorkspaceInsights({
        consecutiveMissedMeetings: null,
        financialSummary: null,
        tasks: twoDone,
        now: NOW,
      }),
    ).toHaveLength(0);

    const threeDone = [
      ...twoDone,
      task({
        id: 3,
        title: "C",
        status: "done",
        is_complete: true,
        created_at: "2026-07-01T00:00:00.000Z",
      }),
    ];
    const insights = buildMemberWorkspaceInsights({
      consecutiveMissedMeetings: null,
      financialSummary: null,
      tasks: threeDone,
      now: NOW,
    });
    expect(insights.map((row) => row.id)).toContain("high_task_completion");
  });

  it("flags a task overdue by 7+ days", () => {
    const insights = buildMemberWorkspaceInsights({
      consecutiveMissedMeetings: null,
      financialSummary: null,
      tasks: [
        task({
          id: 9,
          title: "Book venue",
          due_date: "2026-07-01T00:00:00.000Z",
          is_overdue: true,
          is_complete: false,
          status: "todo",
        }),
      ],
      now: NOW,
    });
    expect(insights[0].message).toBe(
      "Has an overdue responsibility: 'Book venue'.",
    );
  });

  it("ignores tasks overdue by fewer than 7 days", () => {
    expect(
      findTaskOverdueByDays(
        [
          task({
            id: 1,
            title: "Soon",
            due_date: "2026-07-10T00:00:00.000Z",
            is_overdue: true,
          }),
        ],
        7,
        NOW,
      ),
    ).toBeNull();
  });

  it("counts only tasks created inside the window", () => {
    const counts = countTasksInLastDays(
      [
        task({
          id: 1,
          title: "Old",
          created_at: "2025-01-01T00:00:00.000Z",
          status: "done",
          is_complete: true,
        }),
        task({
          id: 2,
          title: "New",
          created_at: "2026-06-20T00:00:00.000Z",
          status: "done",
          is_complete: true,
        }),
      ],
      90,
      NOW,
    );
    expect(counts).toEqual({ assigned: 1, completed: 1 });
  });
});
