import { describe, expect, it } from "vitest";

import type { EventTaskResponse, TaskOverviewMember } from "./event-tasks-api";
import {
  activeTaskCountFromMyTasks,
  activeTaskCountFromOverviewMember,
  outstandingDuesMetricLabel,
} from "./member-workspace-metrics";

describe("member-workspace-metrics helpers", () => {
  it("counts todo + in_progress from overview", () => {
    const member: TaskOverviewMember = {
      member_id: 1,
      full_name: "Alex",
      role: "board",
      position: "member",
      total: 5,
      completed: 2,
      in_progress: 1,
      todo: 2,
      completion_percent: 40,
      tasks: [],
    };
    expect(activeTaskCountFromOverviewMember(member)).toBe(3);
  });

  it("counts incomplete tasks from my-tasks list", () => {
    const tasks = [
      { status: "todo" },
      { status: "in_progress" },
      { status: "done" },
    ] as EventTaskResponse[];
    expect(activeTaskCountFromMyTasks(tasks)).toBe(2);
  });

  it("formats outstanding dues labels", () => {
    expect(outstandingDuesMetricLabel(undefined)).toBeNull();
    expect(
      outstandingDuesMetricLabel({
        id: 1,
        member_id: 3,
        member_name: "Alex",
        member_email: "a@semo.edu",
        semester: "2026-summer",
        amount_owed: "20.00",
        amount_paid: "0.00",
        status: "unpaid",
        paid_at: null,
        payment_method: null,
        note: null,
        finance_entry_id: null,
      }),
    ).toBe("$20.00");
  });
});
