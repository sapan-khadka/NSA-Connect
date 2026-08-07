import { describe, expect, it } from "vitest";

import { buildTodaysFocusItems } from "../components/home/HomeTodaysFocus";
import type { EventResponse } from "./events-api";
import type { MyTasksSummary } from "./home-tasks";

const emptyTasks: MyTasksSummary = {
  openCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  upcomingCount: 0,
  completedTodayCount: 0,
  nextTask: null,
  overdueTask: null,
  previewTasks: [],
  overdueTasks: [],
  dueTodayTasks: [],
  upcomingTasks: [],
  completedTodayTasks: [],
};

const event = (overrides: Partial<EventResponse> = {}): EventResponse => ({
  id: 9,
  name: "Dashain 2026",
  starts_at: "2026-08-12T18:00:00",
  ends_at: null,
  event_type: "cultural",
  description: "",
  location: null,
  capacity: null,
  budget: "0",
  created_by_id: 1,
  current_member_rsvp_status: null,
  finance_lock_at: "2026-08-12T18:00:00",
  is_finance_locked: false,
  is_past: false,
  is_finance_grace_period: false,
  show_in_photo_archive: false,
  meeting_visibility: "board_only",
  ...overrides,
});

describe("buildTodaysFocusItems", () => {
  it("surfaces overdue tasks ahead of the next-event restatement", () => {
    const items = buildTodaysFocusItems({
      tasksSummary: { ...emptyTasks, overdueCount: 2, openCount: 2 },
      tasksPath: "/events/tasks",
      pendingMemberApprovals: 0,
      financePendingCount: 0,
      canReviewMembers: true,
      canReviewFinance: true,
      treasuryBalance: null,
      nextEvent: event(),
      now: new Date("2026-08-01T12:00:00"),
    });

    expect(items[0]?.id).toBe("overdue");
    expect(items.find((item) => item.id === "next-event")?.label).toMatch(
      /starts in \d+ days/,
    );
  });

  it("surfaces budget deficit first when treasury is negative", () => {
    const items = buildTodaysFocusItems({
      tasksSummary: emptyTasks,
      tasksPath: "/events/tasks",
      pendingMemberApprovals: 0,
      financePendingCount: 0,
      canReviewMembers: true,
      canReviewFinance: true,
      treasuryBalance: -159,
      nextEvent: null,
    });
    expect(items[0]).toMatchObject({
      id: "budget-deficit",
      detail: "-$159",
    });
  });
});
