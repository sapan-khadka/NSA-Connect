import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { PastEventsPage } from "./PastEventsPage";

vi.mock("../lib/events-api", () => ({
  fetchPastEvents: vi.fn(),
}));

vi.mock("../lib/finance-api", () => ({
  fetchEventBudgetBreakdown: vi.fn(),
}));

const boardMember = {
  id: 1,
  full_name: "Board User",
  email: "board@semo.edu",
  student_id: "11223344",
  major: "CS",
  graduation_year: 2027,
  role: "board" as const,
  status: "approved" as const,
  position: "member" as const,
};

describe("PastEventsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists archived past events with finance status", async () => {
    const { fetchPastEvents } = await import("../lib/events-api");
    const { fetchEventBudgetBreakdown } = await import("../lib/finance-api");

    vi.mocked(fetchPastEvents).mockResolvedValue({
      events: [
        {
          id: 9,
          name: "Holi Festival",
          starts_at: "2020-03-10T18:00:00+00:00",
          ends_at: null,
          event_type: "cultural",
          description: "Completed event.",
          budget: "400.00",
          created_by_id: 1,
          current_member_rsvp_status: null,
          finance_lock_at: "2020-03-11T18:00:00+00:00",
          is_finance_locked: true,
          is_past: true,
          is_finance_grace_period: false,
        },
      ],
      total: 1,
    });
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue({
      events: [
        {
          event_id: 9,
          event_name: "Holi Festival",
          planned_budget: "400.00",
          actual_expense: "320.00",
          actual_income: "50.00",
          budget_remaining: "80.00",
          over_budget: false,
          entry_count: 4,
        },
      ],
      total: 1,
    });

    render(
      <MockAuthProvider value={{ member: boardMember, isAuthenticated: true }}>
        <MemoryRouter>
          <PastEventsPage />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(await screen.findByText("Holi Festival")).toBeInTheDocument();
    expect(screen.getByText("Finances closed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View close-out" })).toHaveAttribute(
      "href",
      "/events/9/manage",
    );
  });
});
