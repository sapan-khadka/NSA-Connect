import { describe, expect, it } from "vitest";

import type { MemberResponse } from "./auth-api";
import type { MemberDuesRecord } from "./dues-api";
import { buildMemberWorkspaceSnapshot } from "./member-workspace-snapshot";
import {
  activeTaskCountFromMyTasks,
  activeTaskCountFromOverviewMember,
} from "./member-workspace-metrics";

const member: MemberResponse = {
  id: 2,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S1",
  major: "Biology",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "secretary",
};

describe("buildMemberWorkspaceSnapshot", () => {
  it("maps real member fields and uses dashes for unavailable data", () => {
    const chips = buildMemberWorkspaceSnapshot({
      member,
      openTaskCount: null,
    });

    expect(chips.find((c) => c.id === "active_status")?.value).toBe("Active");
    expect(chips.find((c) => c.id === "dues_status")?.value).toBe("—");
    expect(chips.find((c) => c.id === "next_event_rsvp")?.value).toBe("—");
    expect(chips.find((c) => c.id === "open_tasks")?.value).toBe("—");
    expect(chips.find((c) => c.id === "board_role")?.value).toBe(
      "Board · Secretary",
    );
    expect(chips.find((c) => c.id === "graduation_year")?.value).toBe("2028");
  });

  it("uses dues status and open task counts when provided", () => {
    const dues: MemberDuesRecord = {
      id: 1,
      member_id: 2,
      member_name: "Alex",
      member_email: "a@semo.edu",
      semester: "2026-summer",
      amount_owed: "20.00",
      amount_paid: "5.00",
      status: "partial",
      paid_at: null,
      payment_method: null,
      note: null,
      finance_entry_id: null,
    };

    const chips = buildMemberWorkspaceSnapshot({
      member,
      openTaskCount: 3,
      duesRecord: dues,
    });

    expect(chips.find((c) => c.id === "dues_status")?.value).toBe("Partial");
    expect(chips.find((c) => c.id === "open_tasks")?.value).toBe("3");
  });
});

describe("task count helpers remain available for snapshot wiring", () => {
  it("counts active tasks from overview rows", () => {
    expect(
      activeTaskCountFromOverviewMember({
        member_id: 1,
        full_name: "A",
        role: "board",
        position: "member",
        total: 3,
        completed: 1,
        in_progress: 1,
        todo: 1,
        completion_percent: 33,
        tasks: [],
      }),
    ).toBe(2);
  });

  it("counts incomplete personal tasks", () => {
    expect(
      activeTaskCountFromMyTasks([
        { status: "todo" },
        { status: "done" },
      ] as never),
    ).toBe(1);
  });
});
