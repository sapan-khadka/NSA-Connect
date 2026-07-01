import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/members-api", () => ({
  fetchPendingMembers: vi.fn().mockResolvedValue({ members: [], total: 3 }),
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
      await screen.findByRole("heading", { name: /Welcome back, Test User/ }),
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
      await screen.findByRole("heading", { name: /Welcome back, Test User/ }),
    ).toBeInTheDocument();
  });

  it("loads pending approvals on home for board members", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");

    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(fetchPendingMembers).toHaveBeenCalled();
    });
    expect(
      await screen.findByText("Pending signups"),
    ).toBeInTheDocument();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("blocks general members from /members", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/members"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByText("Member directory")).not.toBeInTheDocument();
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

  it("redirects /member/tasks to /events/volunteer for general members", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/member/tasks"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/events/volunteer");
    });
    expect(await screen.findByText("No volunteer tasks yet")).toBeInTheDocument();
  });

  it("redirects board members from /member/tasks to home via volunteer guard", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/member/tasks"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByText("No volunteer tasks yet")).not.toBeInTheDocument();
  });
});
