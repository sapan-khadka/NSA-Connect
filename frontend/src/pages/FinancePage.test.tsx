import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberRole } from "../lib/roles";
import { MockAuthProvider } from "../test/test-utils";

import { FinancePage } from "./FinancePage";

vi.mock("../lib/finance-api", () => ({
  fetchFinanceSummary: vi.fn(),
  fetchEventBudgetBreakdown: vi.fn(),
  fetchExpenseByCategory: vi.fn(),
  fetchFinanceEntries: vi.fn(),
  fetchPendingFinanceChangeRequests: vi.fn(),
  fetchMyFinanceChangeRequests: vi.fn(),
  createFinanceEntry: vi.fn(),
  uploadFinanceReceipt: vi.fn(),
}));

vi.mock("../lib/events-api", () => ({
  fetchEvents: vi.fn().mockResolvedValue({
    events: [
      {
        id: 1,
        name: "Dashain Celebration",
        description: null,
        location: null,
        event_type: "cultural",
        starts_at: "2030-01-01T00:00:00Z",
        ends_at: null,
        is_finance_locked: false,
      },
    ],
    total: 1,
  }),
}));

vi.mock("../lib/dues-api", () => ({
  fetchDuesDashboard: vi.fn().mockResolvedValue({
    summary: {
      semester: "fall-2026",
      default_amount: null,
      member_count: 0,
      paid_count: 0,
      unpaid_count: 0,
      partial_count: 0,
      exempt_count: 0,
      total_expected: "0.00",
      total_collected: "0.00",
      total_outstanding: "0.00",
    },
    records: [],
  }),
  fetchSemesterDuesSettings: vi.fn().mockResolvedValue(null),
  generateDuesRecords: vi.fn(),
  markDuesPaid: vi.fn(),
  markDuesUnpaid: vi.fn(),
  updateMemberDues: vi.fn(),
  upsertSemesterDuesSettings: vi.fn(),
}));

const mockSummary = {
  balance: "260.00",
  total_income: "300.00",
  total_expense: "40.00",
  entry_count: 3,
  pre_event: {
    income: "200.00",
    expense: "0.00",
    balance: "200.00",
    entry_count: 1,
  },
  events: [
    {
      event_id: 1,
      event_name: "Dashain Celebration",
      income: "100.00",
      expense: "40.00",
      balance: "60.00",
      entry_count: 2,
    },
  ],
};

const mockExpenseCategories = {
  total_expense: "165.00",
  categories: [
    { category: "venue", total_expense: "100.00", entry_count: 1 },
    { category: "food_beverage", total_expense: "65.00", entry_count: 2 },
  ],
};

const mockBudgetBreakdown = {
  total: 1,
  events: [
    {
      event_id: 1,
      event_name: "Dashain Celebration",
      planned_budget: "250.00",
      actual_expense: "270.00",
      actual_income: "120.00",
      budget_remaining: "-20.00",
      over_budget: true,
      entry_count: 3,
    },
  ],
};

function renderFinancePage(
  role: MemberRole = "treasurer",
  initialEntry = "/finance",
) {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "Finance User",
          email: "finance@semo.edu",
          student_id: "55443322",
          major: "Administration",
          graduation_year: 2028,
          role,
          status: "approved",
          position: "member",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <FinancePage />
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("FinancePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows event budgets for board members", async () => {
    const { fetchEventBudgetBreakdown, fetchExpenseByCategory, fetchFinanceSummary } =
      await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);

    renderFinancePage("board");

    expect(
      await screen.findByRole("heading", { name: "Event budget tracking" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("event-budget-list")).toBeInTheDocument();
    expect(screen.getByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByText("108%")).toBeInTheDocument();
    expect(screen.queryByText("Spend by category")).not.toBeInTheDocument();
    expect(screen.queryByTestId("expense-category-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-net-balance")).not.toBeInTheDocument();
    expect(fetchFinanceSummary).not.toHaveBeenCalled();
  });

  it("shows treasury pulse and tabs for treasurer", async () => {
    const user = userEvent.setup();
    const {
      fetchEventBudgetBreakdown,
      fetchExpenseByCategory,
      fetchFinanceSummary,
      fetchFinanceEntries,
      fetchPendingFinanceChangeRequests,
      fetchMyFinanceChangeRequests,
    } = await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);
    vi.mocked(fetchFinanceEntries).mockResolvedValue({ entries: [], total: 0 });
    vi.mocked(fetchPendingFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
    });
    vi.mocked(fetchMyFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
      summary: {
        pending_count: 0,
        recently_rejected_count: 0,
        recently_approved_count: 0,
      },
    });

    renderFinancePage("treasurer");

    expect(await screen.findByText("Treasury")).toBeInTheDocument();
    expect(screen.getByText(/All time · updated/)).toBeInTheDocument();
    expect(await screen.findByTestId("finance-net-balance-amount")).toHaveTextContent(
      "$260.00",
    );
    expect(screen.queryByTestId("finance-pending-count")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pulse" })).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.queryByTestId("finance-entry-list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Books" }));

    expect(
      screen.getByRole("button", { name: "+ Log transaction" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("finance-entry-list")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by event")).toBeInTheDocument();
    expect(screen.getByText("Transaction breakdown")).toBeInTheDocument();
    expect(fetchEventBudgetBreakdown).toHaveBeenCalledWith(undefined);
    expect(fetchExpenseByCategory).toHaveBeenCalledWith(undefined);
    expect(fetchFinanceSummary).toHaveBeenCalledWith(undefined);
  });

  it("scopes Books to an event from the event_id query param", async () => {
    const {
      fetchEventBudgetBreakdown,
      fetchExpenseByCategory,
      fetchFinanceSummary,
      fetchFinanceEntries,
      fetchPendingFinanceChangeRequests,
      fetchMyFinanceChangeRequests,
    } = await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);
    vi.mocked(fetchFinanceEntries).mockResolvedValue({ entries: [], total: 0 });
    vi.mocked(fetchPendingFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
    });
    vi.mocked(fetchMyFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
      summary: {
        pending_count: 0,
        recently_rejected_count: 0,
        recently_approved_count: 0,
      },
    });

    renderFinancePage("treasurer", "/finance?tab=books&event_id=1");

    expect(await screen.findByTestId("finance-entry-list")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by event")).toHaveValue("1");
    await waitFor(() => {
      expect(fetchFinanceEntries).toHaveBeenCalledWith({ event_id: 1 });
    });
  });

  it("opens the inbox tab from the tab query param", async () => {
    const {
      fetchEventBudgetBreakdown,
      fetchExpenseByCategory,
      fetchFinanceSummary,
      fetchPendingFinanceChangeRequests,
      fetchMyFinanceChangeRequests,
    } = await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);
    vi.mocked(fetchPendingFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
    });
    vi.mocked(fetchMyFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
      summary: {
        pending_count: 0,
        recently_rejected_count: 0,
        recently_approved_count: 0,
      },
    });

    renderFinancePage("treasurer", "/finance?tab=approvals");

    expect(await screen.findByTestId("finance-inbox")).toBeInTheDocument();
    expect(
      await screen.findByText("Pending finance approvals"),
    ).toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.queryByTestId("finance-net-balance")).not.toBeInTheDocument();
  });

  it("auto-opens inbox when there are pending approvals", async () => {
    const {
      fetchEventBudgetBreakdown,
      fetchExpenseByCategory,
      fetchFinanceSummary,
      fetchPendingFinanceChangeRequests,
      fetchMyFinanceChangeRequests,
    } = await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);
    vi.mocked(fetchPendingFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 1,
    });
    vi.mocked(fetchMyFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
      summary: {
        pending_count: 0,
        recently_rejected_count: 0,
        recently_approved_count: 0,
      },
    });

    renderFinancePage("treasurer", "/finance");

    expect(await screen.findByTestId("finance-inbox")).toBeInTheDocument();
    expect(
      await screen.findByText("Pending finance approvals"),
    ).toBeInTheDocument();
  });

  it("reloads event budgets when semester filter changes for board", async () => {
    const user = userEvent.setup();
    const { fetchEventBudgetBreakdown, fetchExpenseByCategory, fetchFinanceSummary } =
      await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);

    renderFinancePage("board");
    await screen.findByTestId("event-budget-list");

    const semesterSelect = screen.getByRole("combobox", { name: "Semester" });
    const firstSemesterOption = semesterSelect.querySelectorAll("option")[1];
    const semesterValue = firstSemesterOption?.getAttribute("value");

    expect(semesterValue).toBeTruthy();
    await user.selectOptions(semesterSelect, semesterValue!);

    await waitFor(() => {
      expect(fetchEventBudgetBreakdown).toHaveBeenLastCalledWith({
        semester: semesterValue,
      });
    });
    expect(fetchExpenseByCategory).not.toHaveBeenCalled();
    expect(fetchFinanceSummary).not.toHaveBeenCalled();
  });
});
