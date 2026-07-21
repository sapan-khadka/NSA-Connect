import { describe, expect, it } from "vitest";

import { buildHomeUrgencyChips } from "../components/home/HomeUrgencyChips";
import type { MyTasksSummary } from "./home-tasks";

const emptySummary: MyTasksSummary = {
  openCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  nextTask: null,
  overdueTask: null,
  previewTasks: [],
};

describe("buildHomeUrgencyChips", () => {
  it("returns nothing when everything is clear", () => {
    expect(
      buildHomeUrgencyChips({
        tasksSummary: emptySummary,
        tasksPath: "/events/tasks",
        pendingMemberApprovals: 0,
        financePendingCount: 0,
        canReviewMembers: true,
        canReviewFinance: true,
      }),
    ).toEqual([]);
  });

  it("includes only non-zero overdue, due today, and reviews", () => {
    expect(
      buildHomeUrgencyChips({
        tasksSummary: {
          ...emptySummary,
          overdueCount: 2,
          dueTodayCount: 1,
          openCount: 3,
        },
        tasksPath: "/events/tasks",
        pendingMemberApprovals: 1,
        financePendingCount: 2,
        canReviewMembers: true,
        canReviewFinance: true,
      }),
    ).toEqual([
      {
        id: "overdue",
        count: 2,
        label: "overdue",
        to: "/events/tasks",
        tone: "urgent",
      },
      {
        id: "due-today",
        count: 1,
        label: "due today",
        to: "/events/tasks",
        tone: "warn",
      },
      {
        id: "reviews",
        count: 3,
        label: "reviews",
        to: "/members?tab=pending",
        tone: "warn",
      },
    ]);
  });

  it("adds a notes-needed chip when a meeting still needs minutes", () => {
    expect(
      buildHomeUrgencyChips({
        tasksSummary: emptySummary,
        tasksPath: "/events/tasks",
        pendingMemberApprovals: 0,
        financePendingCount: 0,
        canReviewMembers: true,
        canReviewFinance: true,
        notesNeededPath: "/events/meetings/4#meeting-minutes",
      }),
    ).toEqual([
      {
        id: "notes-needed",
        label: "Notes needed",
        to: "/events/meetings/4#meeting-minutes",
        tone: "info",
      },
    ]);
  });
});
