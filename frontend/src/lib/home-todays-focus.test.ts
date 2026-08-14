import { describe, expect, it } from "vitest";

import {
  buildTodaysFocusItems,
  FOCUS_NEXT_EVENT_HORIZON_DAYS,
  pickMinutesMissingMeeting,
} from "./home-todays-focus";
import type { EventResponse } from "./events-api";
import type { MyTasksSummary } from "./home-tasks";
import type { MeetingSummary } from "./meetings-api";

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

const meeting = (overrides: Partial<MeetingSummary> = {}): MeetingSummary => ({
  event_id: 1,
  event_name: "WT Meeting 5",
  starts_at: "2026-07-20T18:00:00",
  is_past: true,
  agenda: "",
  has_attendance: true,
  has_minutes: false,
  has_summary: false,
  present_count: 0,
  absent_count: 0,
  excused_count: 0,
  unmarked_count: 0,
  action_item_count: 0,
  minutes_updated_at: null,
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
      nextEvent: event({ starts_at: "2026-08-05T18:00:00" }),
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

  it("includes both member and finance approvals when both are pending", () => {
    const items = buildTodaysFocusItems({
      tasksSummary: emptyTasks,
      tasksPath: "/events/tasks",
      pendingMemberApprovals: 2,
      financePendingCount: 3,
      canReviewMembers: true,
      canReviewFinance: true,
      treasuryBalance: null,
      nextEvent: null,
    });
    expect(items.map((i) => i.id)).toEqual([
      "member-reviews",
      "finance-reviews",
    ]);
  });

  it("omits next-event countdown outside the near-term horizon", () => {
    const now = new Date("2026-08-01T12:00:00");
    const far = new Date(now);
    far.setDate(far.getDate() + FOCUS_NEXT_EVENT_HORIZON_DAYS + 5);

    const items = buildTodaysFocusItems({
      tasksSummary: emptyTasks,
      tasksPath: "/events/tasks",
      pendingMemberApprovals: 0,
      financePendingCount: 0,
      canReviewMembers: true,
      canReviewFinance: true,
      treasuryBalance: null,
      nextEvent: event({ starts_at: far.toISOString() }),
      now,
    });

    expect(items.find((item) => item.id === "next-event")).toBeUndefined();
  });

  it("includes next-event when within the horizon", () => {
    const items = buildTodaysFocusItems({
      tasksSummary: emptyTasks,
      tasksPath: "/events/tasks",
      pendingMemberApprovals: 0,
      financePendingCount: 0,
      canReviewMembers: true,
      canReviewFinance: true,
      treasuryBalance: null,
      nextEvent: event({ name: "Welcome Week", starts_at: "2026-08-08T18:00:00" }),
      now: new Date("2026-08-01T12:00:00"),
    });

    expect(items.find((item) => item.id === "next-event")?.label).toMatch(
      /^Welcome Week starts in \d+ days$/,
    );
  });
});

describe("pickMinutesMissingMeeting", () => {
  const now = new Date("2026-08-01T12:00:00");

  it("picks the most recent past meeting without minutes in lookback", () => {
    const picked = pickMinutesMissingMeeting(
      [
        meeting({
          event_id: 1,
          event_name: "Old gap",
          starts_at: "2026-06-01T18:00:00",
        }),
        meeting({
          event_id: 2,
          event_name: "WT Meeting 5",
          starts_at: "2026-07-20T18:00:00",
        }),
        meeting({
          event_id: 3,
          event_name: "Already filed",
          starts_at: "2026-07-25T18:00:00",
          has_minutes: true,
        }),
      ],
      now,
    );
    expect(picked).toEqual({ eventId: 2, name: "WT Meeting 5" });
  });

  it("ignores meetings outside the lookback window", () => {
    const picked = pickMinutesMissingMeeting(
      [
        meeting({
          event_id: 1,
          event_name: "Ancient",
          starts_at: "2025-01-01T18:00:00",
        }),
      ],
      now,
    );
    expect(picked).toBeNull();
  });
});
