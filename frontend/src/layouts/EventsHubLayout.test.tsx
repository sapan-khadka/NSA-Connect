import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/events-api", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchUpcomingEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchEvent: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Event",
    starts_at: "2030-06-01T18:00:00+00:00",
    ends_at: null,
    event_type: "cultural",
    description: "",
    budget: "250.00",
    created_by_id: 1,
    current_member_rsvp_status: null,
    finance_lock_at: null,
    is_finance_locked: false,
    is_past: false,
    is_finance_grace_period: false,
    show_in_photo_archive: true,
    prep_tasks: [],
    current_member_volunteer_signup: null,
  }),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
  fetchTaskOverview: vi.fn().mockResolvedValue({
    total_tasks: 0,
    completed_tasks: 0,
    members: [],
  }),
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

  it("shows Calendar and My tasks tabs for general members", async () => {
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
    expect(screen.getByRole("link", { name: "Photo archive" })).toHaveAttribute(
      "href",
      "/events/photos",
    );
    expect(screen.queryByRole("heading", { name: "Events" })).not.toBeInTheDocument();
  });

  it("shows My tasks tab for board members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/tasks"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    const myTasksTab = await screen.findByRole("link", { name: "My tasks" });
    expect(myTasksTab).toHaveAttribute("href", "/events/tasks");
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
    expect(screen.getByRole("link", { name: "Board meetings" })).toHaveAttribute(
      "href",
      "/events/meetings",
    );
    expect(screen.queryByRole("link", { name: "Task oversight" })).not.toBeInTheDocument();
  });

  it("shows Task oversight for president and highlights it on /events/oversight", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/oversight"],
      auth: {
        member: createMockMember("president"),
        isAuthenticated: true,
      },
    });

    const oversightTab = await screen.findByRole("link", { name: "Task oversight" });
    expect(oversightTab).toHaveAttribute("href", "/events/oversight");
    expect(oversightTab.className).toContain("border-accent");
  });

  it("shows Task oversight for vice president", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/oversight"],
      auth: {
        member: createMockMember("board", { position: "vice_president" }),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("link", { name: "Task oversight" })).toHaveAttribute(
      "href",
      "/events/oversight",
    );
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
    expect(screen.queryByRole("link", { name: "Board meetings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Task oversight" })).not.toBeInTheDocument();
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
