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
  group_name: "Food & Beverage",
  due_date: "2030-05-20T12:00:00+00:00",
  assignee_id: null,
  is_overdue: false,
  is_complete: false,
  checklist_items: [
    { id: 10, label: "Order catering", is_completed: false, sort_order: 0 },
    { id: 11, label: "Confirm menu", is_completed: false, sort_order: 1 },
  ],
  eventId: 5,
  eventName: "Dashain Celebration",
  eventStartsAt: "2030-06-01T18:00:00+00:00",
};

describe("getKanbanColumn", () => {
  it("maps tasks to todo, in progress, and done", () => {
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
