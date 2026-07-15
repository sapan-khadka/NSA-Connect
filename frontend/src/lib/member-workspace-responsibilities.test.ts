import { describe, expect, it } from "vitest";

import type { EventTaskResponse } from "./event-tasks-api";
import {
  buildResponsibilityItems,
  getAssignTaskPath,
  getResponsibilitiesViewAllPath,
  selectCurrentResponsibilityTasks,
} from "./member-workspace-responsibilities";

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
    due_date: "2026-08-01T12:00:00Z",
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

describe("member-workspace-responsibilities", () => {
  it("keeps only incomplete tasks, overdue first", () => {
    const open = selectCurrentResponsibilityTasks([
      makeTask({ id: 1, is_complete: true, status: "done" }),
      makeTask({
        id: 2,
        title: "Soon",
        due_date: "2026-09-01T12:00:00Z",
      }),
      makeTask({
        id: 3,
        title: "Late",
        due_date: "2026-01-01T12:00:00Z",
        is_overdue: true,
      }),
    ]);

    expect(open.map((task) => task.title)).toEqual(["Late", "Soon"]);
  });

  it("builds items without inventing priority or assignee names", () => {
    const items = buildResponsibilityItems(
      [
        makeTask({
          task_kind: "checklist",
          group_name: "Setup",
          status: "in_progress",
          checklist_items: [
            { id: 1, label: "A", is_completed: true, sort_order: 0 },
            { id: 2, label: "B", is_completed: false, sort_order: 1 },
          ],
        }),
      ],
      { canOpenEventManage: true },
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Setup",
      statusLabel: "In progress",
      assignedByLabel: null,
      detailPath: "/events/10/manage",
      progress: { completed: 1, total: 2, percent: 50 },
    });
  });

  it("routes View All and assign CTAs from role capability", () => {
    expect(getResponsibilitiesViewAllPath({ canViewOversight: true })).toBe(
      "/events/oversight",
    );
    expect(getResponsibilitiesViewAllPath({ canViewOversight: false })).toBe(
      "/events/tasks",
    );
    expect(getAssignTaskPath({ canManageEventTasks: true })).toBe(
      "/events/calendar",
    );
    expect(getAssignTaskPath({ canManageEventTasks: false })).toBeNull();
  });
});
