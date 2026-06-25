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
}));

describe("protected route redirects", () => {
  afterEach(() => {
    cleanup();
  });

  it("sends unauthenticated users from /board to /login", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: { member: null, isAuthenticated: false },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("allows general members to view /member", async () => {
    renderWithRouter(undefined, {
      initialEntries: ["/member"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(screen.getAllByText("Member Dashboard").length).toBeGreaterThan(0);
  });

  it("redirects general members from /board to /member", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/member");
    });
    expect(screen.getAllByText("Member Dashboard").length).toBeGreaterThan(0);
  });

  it("allows board members to view /board and loads pending approvals", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");

    renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText("Board Dashboard").length).toBeGreaterThan(0);
    });
    expect(fetchPendingMembers).toHaveBeenCalled();
  });

  it("redirects board members from /member to /board", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/member"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/board");
    });
    expect(screen.getAllByText("Board Dashboard").length).toBeGreaterThan(0);
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
      expect(router.state.location.pathname).toBe("/member");
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

  it("redirects general members from /finance to /member", async () => {
    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/member");
    });
    expect(screen.queryByText("Event budget tracking")).not.toBeInTheDocument();
  });
});
