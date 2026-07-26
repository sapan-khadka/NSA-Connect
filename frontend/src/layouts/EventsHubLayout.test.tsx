import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

async function eventsNav() {
  return within(await screen.findByRole("navigation", { name: "Events sections" }));
}

vi.mock("../lib/events-api", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchUpcomingEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchEventVolunteerSignups: vi.fn().mockResolvedValue({ signups: [], total: 0 }),
  fetchEventAttendees: vi.fn().mockResolvedValue({
    going_count: 0,
    maybe_count: 0,
    not_going_count: 0,
    no_response_count: 0,
    attendees: [],
  }),
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

vi.mock("../lib/notifications-api", () => ({
  EMPTY_NOTIFICATION_SUMMARY: {
    members_pending: 0,
    finance_pending: 0,
    suggestions_pending: 0,
    discussions_unread: 0,
    tasks_overdue: 0,
    tasks_due_today: 0,
    tasks_oversight_overdue: 0,
    attention_total: 0,
  },
  EMPTY_INBOX: {
    notifications: [],
    total: 0,
    unread_count: 0,
  },
  fetchNotificationSummary: vi.fn().mockResolvedValue({
    members_pending: 0,
    finance_pending: 0,
    suggestions_pending: 2,
    discussions_unread: 0,
    tasks_overdue: 1,
    tasks_due_today: 1,
    tasks_oversight_overdue: 3,
    attention_total: 7,
  }),
  fetchInboxNotifications: vi.fn().mockResolvedValue({
    notifications: [],
    total: 0,
    unread_count: 0,
  }),
  markInboxNotificationRead: vi.fn(),
  markAllInboxNotificationsRead: vi.fn(),
}));

describe("EventsHubLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Ideas and Photos as primary tabs for general members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    expect(nav.getByRole("link", { name: /Calendar/ })).toHaveAttribute(
      "href",
      "/events/calendar",
    );
    expect(nav.getByRole("link", { name: /^Tasks/ })).toHaveAttribute(
      "href",
      "/events/tasks",
    );
    expect(nav.getByRole("link", { name: /^Ideas/ })).toHaveAttribute(
      "href",
      "/events/ideas",
    );
    expect(nav.getByRole("link", { name: /Photos/ })).toHaveAttribute(
      "href",
      "/events/photos",
    );
    expect(
      nav.queryByRole("button", { name: /More events sections/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Events" })).not.toBeInTheDocument();
  });

  it("shows Tasks tab for board members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/tasks"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    const tasksTab = nav.getByRole("link", { name: /^Tasks/ });
    expect(tasksTab).toHaveAttribute("href", "/events/tasks");
    expect(tasksTab.className).toContain("border-accent");
  });

  it("keeps Meetings, Ideas, and Photos primary for board members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    expect(nav.getByRole("link", { name: /Meetings/ })).toHaveAttribute(
      "href",
      "/events/meetings",
    );
    expect(nav.getByRole("link", { name: /^Ideas/ })).toHaveAttribute(
      "href",
      "/events/ideas",
    );
    expect(nav.getByRole("link", { name: /Photos/ })).toHaveAttribute(
      "href",
      "/events/photos",
    );
    expect(nav.queryByRole("link", { name: /Past events/ })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: /Oversight/ })).not.toBeInTheDocument();
  });

  it("shows Ideas and Oversight as primary tabs for presidents", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("president"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    expect(nav.getByRole("link", { name: /^Ideas/ })).toHaveAttribute(
      "href",
      "/events/ideas",
    );
    expect(nav.getByRole("link", { name: /^Oversight/ })).toHaveAttribute(
      "href",
      "/events/oversight",
    );
    expect(nav.getByRole("link", { name: /^Ideas/ })).toHaveTextContent("2");
    expect(nav.getByRole("link", { name: /^Oversight/ })).toHaveTextContent("3");

    const user = userEvent.setup();
    await user.click(nav.getByRole("button", { name: /More events sections/i }));
    expect(screen.getByRole("menuitem", { name: /Past events/ })).toBeInTheDocument();
  });

  it("highlights Oversight when task oversight is active", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/oversight"],
      auth: {
        member: createMockMember("president"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    const oversight = nav.getByRole("link", { name: /^Oversight/ });
    expect(oversight).toHaveAttribute("aria-current", "page");
    expect(oversight.className).toContain("border-accent");
  });

  it("shows Oversight as a primary tab for vice president", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/oversight"],
      auth: {
        member: createMockMember("board", { position: "vice_president" }),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    expect(nav.getByRole("link", { name: /^Oversight/ })).toHaveAttribute(
      "href",
      "/events/oversight",
    );
  });

  it("hides board-only destinations for general members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    expect(nav.queryByRole("link", { name: /Meetings/ })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: /Past events/ })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: /Oversight/ })).not.toBeInTheDocument();
    expect(nav.getByRole("link", { name: /^Ideas/ })).toBeInTheDocument();
  });

  it("hides the tab bar on event manage pages", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/1/manage"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("navigation", { name: "Events sections" }),
      ).not.toBeInTheDocument();
    });
  });
});
