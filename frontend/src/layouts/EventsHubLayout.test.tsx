import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/events-api", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchEvent: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Event",
    starts_at: "2030-06-01T18:00:00+00:00",
    ends_at: null,
    event_type: "cultural",
    description: "",
    budget: "250.00",
    created_by_id: 1,
    rsvp_count: 0,
    current_member_has_rsvped: false,
    finance_lock_at: null,
    is_finance_locked: false,
    is_past: false,
    is_finance_grace_period: false,
    prep_tasks: [],
  }),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
}));

vi.mock("../lib/finance-api", () => ({
  fetchEventBudgetForEvent: vi.fn().mockResolvedValue(null),
}));

vi.mock("../lib/members-api", () => ({
  fetchAssignableMembers: vi.fn().mockResolvedValue({ members: [], total: 0 }),
}));

describe("EventsHubLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Calendar and My tasks tabs for all members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/events/calendar",
    );
    expect(screen.getByRole("link", { name: "My tasks" })).toHaveAttribute(
      "href",
      "/events/tasks",
    );
    expect(screen.getByRole("heading", { name: "Events" })).toBeInTheDocument();
  });

  it("highlights the active tab", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/tasks"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    const myTasksTab = await screen.findByRole("link", { name: "My tasks" });
    expect(myTasksTab.className).toContain("border-accent");
  });

  it("shows Past events for board members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("link", { name: "Past events" })).toBeInTheDocument();
  });

  it("hides Past events for general members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await screen.findByRole("link", { name: "Calendar" });
    expect(screen.queryByRole("link", { name: "Past events" })).not.toBeInTheDocument();
  });

  it("shows Oversight for president and vice president", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("president"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("link", { name: "Oversight" })).toBeInTheDocument();
  });

  it("shows Volunteer signups only for general members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(
      await screen.findByRole("link", { name: "Volunteer signups" }),
    ).toBeInTheDocument();
  });

  it("hides Volunteer signups for board members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await screen.findByRole("link", { name: "Calendar" });
    expect(
      screen.queryByRole("link", { name: "Volunteer signups" }),
    ).not.toBeInTheDocument();
  });

  it("hides the tab bar on event manage pages", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/1/manage"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await screen.findByText("← Back to calendar");
    expect(screen.queryByRole("link", { name: "Calendar" })).not.toBeInTheDocument();
  });
});
