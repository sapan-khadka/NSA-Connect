import { describe, expect, it } from "vitest";

import type { PrepTaskResponse } from "./events-api";
import {
  applyChecklistToggle,
  calcPrepProgress,
  calcTaskProgress,
} from "./prep-progress";

const task: PrepTaskResponse = {
  id: 1,
  group_name: "Setup",
  due_date: "2030-06-10T12:00:00+00:00",
  assignee_id: null,
  is_overdue: false,
  is_complete: false,
  checklist_items: [
    { id: 1, label: "A", is_completed: true, sort_order: 0 },
    { id: 2, label: "B", is_completed: false, sort_order: 1 },
    { id: 3, label: "C", is_completed: false, sort_order: 2 },
  ],
};

describe("prep progress", () => {
  it("calculates event-wide progress", () => {
    expect(calcPrepProgress([task])).toEqual({
      completed: 1,
      total: 3,
      percent: 33,
    });
  });

  it("calculates task progress", () => {
    expect(calcTaskProgress(task).percent).toBe(33);
  });

  it("updates checklist completion optimistically", () => {
    const updated = applyChecklistToggle(task, 2, true);
    expect(updated.checklist_items[1].is_completed).toBe(true);
    expect(updated.is_complete).toBe(false);

    const complete = applyChecklistToggle(updated, 3, true);
    expect(complete.is_complete).toBe(true);
  });
});
