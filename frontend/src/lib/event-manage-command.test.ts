import { describe, expect, it } from "vitest";

import {
  buildNeedsAttentionItems,
  parseManageTab,
  shouldOpenEventEditor,
} from "./event-manage-command";
import type { EventDetailResponse } from "./events-api";
import type { EventTaskResponse } from "./event-tasks-api";

function event(overrides: Partial<EventDetailResponse> = {}): EventDetailResponse {
  return {
    id: 1,
    name: "Peace Initiative",
    description: "A campus gathering.",
    location: "Dempster",
    event_type: "social",
    starts_at: "2026-09-21T23:00:00Z",
    ends_at: null,
    budget: "3000.00",
    capacity: 300,
    event_photo_url: "https://cdn.example/cover.jpg",
    show_in_photo_archive: true,
    is_past: false,
    is_finance_locked: false,
    meeting_visibility: "public",
    current_member_rsvp_status: null,
    ...overrides,
  } as EventDetailResponse;
}

function task(overrides: Partial<EventTaskResponse> = {}): EventTaskResponse {
  return {
    id: 9,
    event_id: 1,
    event_name: "Peace Initiative",
    task_kind: "simple",
    title: "Book venue",
    group_name: null,
    description: "",
    status: "todo",
    assignee_id: 2,
    assignee_name: "Mukesh",
    due_date: "2026-07-29",
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: 1,
    created_at: "2026-07-01T12:00:00Z",
    ...overrides,
  };
}

describe("parseManageTab", () => {
  it("maps current and legacy tab ids", () => {
    expect(parseManageTab(null)).toBe("overview");
    expect(parseManageTab("attendees")).toBe("attendees");
    expect(parseManageTab("people")).toBe("attendees");
    expect(parseManageTab("ops")).toBe("operations");
    expect(parseManageTab("operations")).toBe("operations");
    expect(parseManageTab("details")).toBe("overview");
    expect(parseManageTab("unknown")).toBe("overview");
  });
});

describe("shouldOpenEventEditor", () => {
  it("opens the editor from legacy details tab or edit query", () => {
    expect(shouldOpenEventEditor("details", null)).toBe(true);
    expect(shouldOpenEventEditor(null, "1")).toBe(true);
    expect(shouldOpenEventEditor("attendees", null)).toBe(false);
  });
});

describe("buildNeedsAttentionItems", () => {
  it("surfaces missing volunteer roles and open tasks", () => {
    const items = buildNeedsAttentionItems({
      event: event(),
      readinessInput: {
        event: event(),
        budget: {
          event_id: 1,
          event_name: "Peace Initiative",
          planned_budget: "3000.00",
          actual_expense: "10.00",
          actual_income: "0.00",
          budget_remaining: "2990.00",
          over_budget: false,
          entry_count: 1,
        },
        volunteerCount: 0,
        volunteerNeeded: 0,
        volunteersLoading: false,
      },
      openTasks: [task()],
    });

    expect(items.some((item) => item.action === "volunteers")).toBe(true);
    expect(items.some((item) => item.id === "open-tasks")).toBe(true);
  });

  it("returns no queue items when the event is ready and tasks are done", () => {
    const ready = event();
    const items = buildNeedsAttentionItems({
      event: ready,
      readinessInput: {
        event: ready,
        budget: {
          event_id: 1,
          event_name: "Peace Initiative",
          planned_budget: "3000.00",
          actual_expense: "10.00",
          actual_income: "0.00",
          budget_remaining: "2990.00",
          over_budget: false,
          entry_count: 1,
        },
        volunteerCount: 6,
        volunteerNeeded: 6,
        volunteersLoading: false,
      },
      openTasks: [],
    });

    expect(items.filter((item) => item.action === "tasks")).toEqual([]);
    expect(items.every((item) => item.action !== "volunteers")).toBe(true);
  });

  it("omits informational readiness items from the queue", () => {
    const past = event({
      is_past: true,
      capacity: null,
      event_photo_url: null,
    });
    const items = buildNeedsAttentionItems({
      event: past,
      readinessInput: {
        event: past,
        budget: {
          event_id: 1,
          event_name: "Peace Initiative",
          planned_budget: "3000.00",
          actual_expense: "10.00",
          actual_income: "0.00",
          budget_remaining: "2990.00",
          over_budget: false,
          entry_count: 1,
        },
        volunteerCount: 6,
        volunteerNeeded: 6,
        volunteersLoading: false,
      },
      openTasks: [],
    });

    expect(items.map((item) => item.id)).not.toEqual(
      expect.arrayContaining([
        "readiness-rsvp",
        "readiness-capacity",
        "readiness-cover",
      ]),
    );
    expect(items).toEqual([]);
  });
});
