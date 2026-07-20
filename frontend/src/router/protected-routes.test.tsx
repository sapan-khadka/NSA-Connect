import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/members-api", () => ({
  fetchPendingMembers: vi.fn().mockResolvedValue({ members: [], total: 3 }),
  fetchMembers: vi.fn().mockResolvedValue({
    members: [],
    total: 0,
    page: 1,
    page_size: 12,
    total_pages: 0,
  }),
  fetchTalentOptions: vi.fn().mockResolvedValue({ talents: [], labels: {} }),
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
    members_pending: 3,
    finance_pending: 0,
    suggestions_pending: 0,
    discussions_unread: 0,
    tasks_overdue: 0,
    tasks_due_today: 0,
    tasks_oversight_overdue: 0,
    attention_total: 3,
  }),
  fetchInboxNotifications: vi.fn().mockResolvedValue({
    notifications: [],
    total: 0,
    unread_count: 0,
  }),
  markInboxNotificationRead: vi.fn(),
  markAllInboxNotificationsRead: vi.fn(),
}));

vi.mock("../lib/finance-api", () => ({
  fetchFinanceSummary: vi.fn().mockResolvedValue({
    balance: "0.00",
    total_income: "0.00",
    total_expense: "0.00",
    entry_count: 0,
    pre_event: { income: "0.00", expense: "0.00", balance: "0.00", entry_count: 0 },
    events: [],
  }),
  fetchEventBudgetBreakdown: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchExpenseByCategory: vi.fn().mockResolvedValue({ categories: [], total_expense: "0.00" }),
  fetchPendingFinanceChangeRequests: vi.fn().mockResolvedValue({ requests: [], total: 0 }),
  fetchMyFinanceChangeRequests: vi.fn().mockResolvedValue({
    requests: [],
    total: 0,
    summary: {
      pending_count: 0,
      recently_rejected_count: 0,
      recently_approved_count: 0,
    },
  }),
  fetchMyFinanceChangeRequestSummary: vi.fn().mockResolvedValue({
    pending_count: 0,
    recently_rejected_count: 0,
    recently_approved_count: 0,
  }),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchMyEventTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
  updateEventTask: vi.fn(),
  updateEventTaskChecklistItem: vi.fn(),
}));

vi.mock("../lib/events-api", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchEvent: vi.fn(),
  fetchUpcomingEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
}));

vi.mock("../lib/volunteer-api", () => ({
  fetchMyVolunteerSignups: vi.fn().mockResolvedValue({ signups: [], total: 0 }),
}));

describe("protected route redirects", () => {
  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated legacy /board URLs to public home", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: { member: null, isAuthenticated: false },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.getByRole("heading", { name: "NSA Connect" })).toBeInTheDocument();
  });

  it("sends unauthenticated users from /events to /login", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/events"],
      auth: { member: null, isAuthenticated: false },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("redirects legacy /member URLs to home", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/member"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(
      await screen.findByRole("heading", {
        name: /Good (Morning|Afternoon|Evening), Test/,
      }),
    ).toBeInTheDocument();
  });

  it("redirects legacy /board URLs to home", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(
      await screen.findByRole("heading", {
        name: /Good (Morning|Afternoon|Evening), Test/,
      }),
    ).toBeInTheDocument();
  });

  it("loads pending approvals on home for board members", async () => {
    const { fetchNotificationSummary } = await import("../lib/notifications-api");

    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(fetchNotificationSummary).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole("link", {
        name: /3 member approvals pending/i,
      }),
    ).toHaveAttribute("href", "/members?tab=pending");
  });

  it("allows general members to browse /members", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/members"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Members" }),
    ).toBeInTheDocument();
  });

  it("allows board members to view /finance budget tracking", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByText("Event budget tracking")).toBeInTheDocument();
  });

  it("redirects general members from /finance to home", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByText("Event budget tracking")).not.toBeInTheDocument();
  });

  it("redirects /tasks to /events/tasks", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/tasks"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/events/tasks");
    });
    expect(
      await screen.findByText("No tasks assigned to you yet"),
    ).toBeInTheDocument();
  });

  it("redirects /board/tasks to /events/tasks", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/board/tasks"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/events/tasks");
    });
    expect(
      await screen.findByText("No tasks assigned to you yet"),
    ).toBeInTheDocument();
  });

  it("redirects /member/tasks to /events/tasks for general members", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/member/tasks"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/events/tasks");
    });
    expect(
      await screen.findByText("No tasks assigned to you yet"),
    ).toBeInTheDocument();
  });

  it("redirects /events/volunteer to /events/tasks", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/events/volunteer"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/events/tasks");
    });
  });

  it("redirects board members from /member/tasks to /events/tasks", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/member/tasks"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/events/tasks");
    });
    expect(
      await screen.findByText("No tasks assigned to you yet"),
    ).toBeInTheDocument();
  });
});
