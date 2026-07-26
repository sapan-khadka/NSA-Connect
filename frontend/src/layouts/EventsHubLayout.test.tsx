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

  it("shows compact primary tabs for general members", async () => {
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
    expect(nav.getByRole("link", { name: /Archive/ })).toHaveAttribute(
      "href",
      "/events/photos",
    );
    expect(nav.getByRole("button", { name: /More events sections/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Events" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: /Photo archive/ })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: /My tasks/ })).not.toBeInTheDocument();
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

  it("keeps Meetings and Archive primary for board members", async () => {
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
    expect(nav.getByRole("link", { name: /Archive/ })).toHaveAttribute(
      "href",
      "/events/photos",
    );
    expect(nav.queryByRole("link", { name: /Past events/ })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: /Task oversight/ })).not.toBeInTheDocument();
  });

  it("puts Suggestions and Task oversight under More for presidents", async () => {
    const user = userEvent.setup();
    renderWithRouter(undefined, {
      initialEntries: ["/events/calendar"],
      auth: {
        member: createMockMember("president"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    const more = nav.getByRole("button", { name: /More events sections/i });
    expect(more).toHaveTextContent("5");
    await user.click(more);

    const suggestions = await screen.findByRole("menuitem", { name: /Suggestions/ });
    expect(suggestions).toHaveTextContent("2");
    expect(screen.getByRole("menuitem", { name: /Task oversight/ })).toHaveTextContent(
      "3",
    );
    expect(screen.getByRole("menuitem", { name: /Past events/ })).toBeInTheDocument();
  });

  it("highlights More when Task oversight is active", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/events/oversight"],
      auth: {
        member: createMockMember("president"),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    const more = nav.getByRole("button", { name: /More events sections/i });
    expect(more).toHaveAttribute("aria-current", "page");
    expect(more).toHaveTextContent("Task oversight");
    expect(more.className).toContain("border-accent");
  });

  it("shows Task oversight under More for vice president", async () => {
    const user = userEvent.setup();
    renderWithRouter(undefined, {
      initialEntries: ["/events/oversight"],
      auth: {
        member: createMockMember("board", { position: "vice_president" }),
        isAuthenticated: true,
      },
    });

    const nav = await eventsNav();
    await user.click(nav.getByRole("button", { name: /More events sections/i }));
    expect(screen.getByRole("menuitem", { name: /Task oversight/ })).toBeInTheDocument();
  });

  it("hides board-only destinations for general members", async () => {
    const user = userEvent.setup();
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
    expect(nav.queryByRole("link", { name: /Task oversight/ })).not.toBeInTheDocument();

    await user.click(nav.getByRole("button", { name: /More events sections/i }));
    expect(screen.getByRole("menuitem", { name: /Suggestions/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Past events/ })).not.toBeInTheDocument();
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
