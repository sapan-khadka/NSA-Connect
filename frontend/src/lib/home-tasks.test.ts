import { describe, expect, it } from "vitest";

import type { EventTaskResponse } from "./event-tasks-api";
import {
  getTaskDisplayName,
  getMyTasksPath,
  summarizeMyTasks,
} from "./home-tasks";

function makeTask(
  overrides: Partial<EventTaskResponse> = {},
): EventTaskResponse {
  return {
    id: 1,
    event_id: 10,
    event_name: "Dashain",
    task_kind: "simple",
    title: "Book venue",
    group_name: null,
    description: "",
    assignee_id: 2,
    assignee_name: "Member",
    status: "todo",
    due_date: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
    ...overrides,
  };
}

describe("home-tasks", () => {
  it("uses group name for checklist tasks", () => {
    expect(
      getTaskDisplayName(
        makeTask({
          task_kind: "checklist",
          group_name: "Setup",
          title: "ignored",
        }),
      ),
    ).toBe("Setup");
  });

  it("summarizes open, overdue, and next due tasks", () => {
    const summary = summarizeMyTasks([
      makeTask({ id: 1, is_complete: true }),
      makeTask({
        id: 2,
        title: "Late task",
        due_date: "2026-01-01T12:00:00Z",
        is_overdue: true,
      }),
      makeTask({
        id: 3,
        title: "Soon task",
        due_date: "2026-12-01T12:00:00Z",
      }),
      makeTask({ id: 4, title: "No due date" }),
    ]);

    expect(summary.openCount).toBe(3);
    expect(summary.overdueCount).toBe(1);
    expect(summary.nextTask?.title).toBe("Late task");
  });

  it("routes every member role to the shared kanban tasks page", () => {
    expect(getMyTasksPath("general")).toBe("/events/tasks");
    expect(getMyTasksPath("board")).toBe("/events/tasks");
    expect(getMyTasksPath("president")).toBe("/events/tasks");
  });
});
