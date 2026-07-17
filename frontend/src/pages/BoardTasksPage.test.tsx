import { describe, expect, it } from "vitest";

import type { KanbanTask } from "../lib/kanban-status";
import { calcBoardTasksStats } from "./BoardTasksPage";

function task(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 1,
    event_id: 5,
    event_name: "Dashain",
    task_kind: "simple",
    title: "Task",
    group_name: null,
    description: "",
    assignee_id: 3,
    assignee_name: "Alex",
    status: "todo",
    due_date: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: null,
    created_at: "2030-05-20T12:00:00+00:00",
    eventId: 5,
    eventName: "Dashain",
    eventStartsAt: "2030-06-01T18:00:00+00:00",
    ...overrides,
  };
}

describe("calcBoardTasksStats", () => {
  const now = new Date(2030, 4, 20, 15, 0, 0); // May 20, 2030 local

  it("counts assigned, due today, overdue, and completed from mine tasks", () => {
    const dueTodayIso = new Date(2030, 4, 20, 18, 0, 0).toISOString();
    const overdueIso = new Date(2030, 4, 18, 12, 0, 0).toISOString();

    const stats = calcBoardTasksStats(
      [
        task({
          id: 1,
          status: "todo",
          due_date: dueTodayIso,
          is_overdue: false,
        }),
        task({
          id: 2,
          status: "in_progress",
          due_date: overdueIso,
          is_overdue: true,
        }),
        task({
          id: 3,
          status: "done",
          is_complete: true,
          due_date: overdueIso,
          is_overdue: false,
        }),
        task({
          id: 4,
          status: "todo",
          due_date: null,
          is_overdue: false,
        }),
      ],
      now,
    );

    expect(stats).toEqual({
      assigned: 4,
      dueToday: 1,
      overdue: 1,
      completed: 1,
      completedPercent: 25,
    });
  });

  it("does not count completed tasks as overdue or due today", () => {
    const stats = calcBoardTasksStats(
      [
        task({
          id: 1,
          status: "done",
          is_complete: true,
          due_date: new Date(2030, 4, 20, 12, 0, 0).toISOString(),
          is_overdue: true,
        }),
      ],
      now,
    );

    expect(stats.dueToday).toBe(0);
    expect(stats.overdue).toBe(0);
    expect(stats.completed).toBe(1);
    expect(stats.completedPercent).toBe(100);
  });
});
