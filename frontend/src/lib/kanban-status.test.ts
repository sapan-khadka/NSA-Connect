import { describe, expect, it } from "vitest";

import {
  applyKanbanMoveLocally,
  getKanbanColumn,
  getKanbanMoveAction,
  groupTasksByKanbanColumn,
  type KanbanTask,
} from "./kanban-status";

const baseTask: KanbanTask = {
  id: 1,
  event_id: 5,
  event_name: "Dashain Celebration",
  task_kind: "checklist",
  title: "Food & Beverage",
  group_name: "Food & Beverage",
  description: "",
  assignee_id: null,
  assignee_name: null,
  status: "todo",
  due_date: "2030-05-20T12:00:00+00:00",
  is_overdue: false,
  is_complete: false,
  checklist_items: [
    { id: 10, label: "Order catering", is_completed: false, sort_order: 0 },
    { id: 11, label: "Confirm menu", is_completed: false, sort_order: 1 },
  ],
  completion_note: null,
  completion_photo_url: null,
  completed_at: null,
  created_by_id: null,
  created_at: "2030-05-20T12:00:00+00:00",
  eventId: 5,
  eventName: "Dashain Celebration",
  eventStartsAt: "2030-06-01T18:00:00+00:00",
};

describe("getKanbanColumn", () => {
  it("maps checklist tasks to todo, in progress, and done", () => {
    expect(getKanbanColumn(baseTask)).toBe("todo");

    const inProgress = applyKanbanMoveLocally(baseTask, {
      type: "toggle_item",
      itemId: 10,
      value: true,
    });
    expect(getKanbanColumn(inProgress)).toBe("in_progress");

    const done = applyKanbanMoveLocally(baseTask, {
      type: "bulk_complete",
      value: true,
    });
    expect(getKanbanColumn(done)).toBe("done");
  });
});

describe("simple task kanban", () => {
  const simpleTask: KanbanTask = {
    ...baseTask,
    id: 2,
    task_kind: "simple",
    title: "Book venue",
    group_name: null,
    checklist_items: [],
    status: "todo",
  };

  it("uses task status for simple tasks", () => {
    expect(getKanbanColumn(simpleTask)).toBe("todo");
    expect(
      getKanbanColumn(
        applyKanbanMoveLocally(simpleTask, {
          type: "set_status",
          status: "in_progress",
        }),
      ),
    ).toBe("in_progress");
  });

  it("moves simple tasks by updating status", () => {
    expect(getKanbanMoveAction(simpleTask, "done")).toEqual({
      type: "set_status",
      status: "done",
    });
  });
});

describe("getKanbanMoveAction", () => {
  it("returns bulk complete when moving to done or todo", () => {
    expect(getKanbanMoveAction(baseTask, "done")).toEqual({
      type: "bulk_complete",
      value: true,
    });
    expect(
      getKanbanMoveAction(
        applyKanbanMoveLocally(baseTask, { type: "bulk_complete", value: true }),
        "todo",
      ),
    ).toEqual({
      type: "bulk_complete",
      value: false,
    });
  });

  it("starts progress by checking the first checklist item", () => {
    expect(getKanbanMoveAction(baseTask, "in_progress")).toEqual({
      type: "toggle_item",
      itemId: 10,
      value: true,
    });
  });
});

describe("groupTasksByKanbanColumn", () => {
  it("groups tasks into three columns", () => {
    const grouped = groupTasksByKanbanColumn([
      baseTask,
      applyKanbanMoveLocally(baseTask, {
        type: "toggle_item",
        itemId: 10,
        value: true,
      }),
      applyKanbanMoveLocally(baseTask, { type: "bulk_complete", value: true }),
    ]);

    expect(grouped.todo).toHaveLength(1);
    expect(grouped.in_progress).toHaveLength(1);
    expect(grouped.done).toHaveLength(1);
  });
});
