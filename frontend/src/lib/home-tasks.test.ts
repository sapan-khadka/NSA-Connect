import { describe, expect, it } from "vitest";

import type { EventTaskResponse } from "./event-tasks-api";
import {
  applyOptimisticTaskComplete,
  buildHomeGreeting,
  buildMarkTaskCompleteRequest,
  getTaskDisplayName,
  getMyTasksPath,
  getTaskUrgency,
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

  it("does not treat completed tasks as high urgency even when overdue", () => {
    expect(
      getTaskUrgency(
        makeTask({
          status: "done",
          is_complete: true,
          is_overdue: true,
          due_date: "2026-01-01T12:00:00Z",
        }),
      ),
    ).toBe("low");
  });

  it("marks open overdue tasks as high urgency", () => {
    expect(
      getTaskUrgency(
        makeTask({
          status: "todo",
          is_overdue: true,
          due_date: "2026-01-01T12:00:00Z",
        }),
      ),
    ).toBe("high");
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
    expect(summary.overdueTask?.title).toBe("Late task");
    expect(summary.previewTasks.map((task) => task.title)).toEqual([
      "Late task",
      "Soon task",
      "No due date",
    ]);
  });

  it("tracks tasks completed today", () => {
    const now = new Date("2026-07-25T15:00:00");
    const summary = summarizeMyTasks(
      [
        makeTask({
          id: 1,
          title: "Done today",
          is_complete: true,
          status: "done",
          completed_at: "2026-07-25T10:00:00",
        }),
        makeTask({
          id: 2,
          title: "Done yesterday",
          is_complete: true,
          status: "done",
          completed_at: "2026-07-24T10:00:00",
        }),
      ],
      now,
    );

    expect(summary.completedTodayCount).toBe(1);
    expect(summary.completedTodayTasks.map((task) => task.title)).toEqual([
      "Done today",
    ]);
  });

  it("routes every member role to the shared kanban tasks page", () => {
    expect(getMyTasksPath("general")).toBe("/events/tasks");
    expect(getMyTasksPath("board")).toBe("/events/tasks");
    expect(getMyTasksPath("president")).toBe("/events/tasks");
  });

  it("marks simple tasks complete via status done", () => {
    expect(buildMarkTaskCompleteRequest(makeTask())).toEqual({
      status: "done",
    });
    expect(applyOptimisticTaskComplete(makeTask())).toMatchObject({
      status: "done",
      is_complete: true,
    });
  });

  it("marks checklist tasks complete via is_complete", () => {
    const checklist = makeTask({
      task_kind: "checklist",
      checklist_items: [
        { id: 1, label: "A", is_completed: false, sort_order: 0 },
        { id: 2, label: "B", is_completed: true, sort_order: 1 },
      ],
    });
    expect(buildMarkTaskCompleteRequest(checklist)).toEqual({
      is_complete: true,
    });
    const optimistic = applyOptimisticTaskComplete(checklist);
    expect(optimistic.is_complete).toBe(true);
    expect(optimistic.status).toBe("done");
    expect(optimistic.checklist_items.every((item) => item.is_completed)).toBe(
      true,
    );
  });

  it("builds a concise Home greeting with only actionable problems", () => {
    const morning = new Date("2026-07-31T09:00:00");
    expect(
      buildHomeGreeting({
        firstName: "Mukesh",
        overdueCount: 3,
        nextEventName: "WT Cultural Night",
        nextEventStartsAt: "2026-07-31T15:00:00",
        now: morning,
      }),
    ).toEqual({
      salutation: "Good morning, Mukesh.",
      detail: "You have 3 overdue tasks.",
    });

    expect(
      buildHomeGreeting({
        firstName: "Mukesh",
        overdueCount: 0,
        nextEventName: "dashian",
        nextEventStartsAt: "2026-08-12T18:00:00",
        now: morning,
      }),
    ).toEqual({
      salutation: "Good morning, Mukesh.",
      detail: "Here’s what’s happening with NSA today.",
    });

    expect(
      buildHomeGreeting({
        firstName: "Mukesh",
        overdueCount: 1,
        now: morning,
      }),
    ).toEqual({
      salutation: "Good morning, Mukesh.",
      detail: "You have 1 overdue task.",
    });
  });
});
