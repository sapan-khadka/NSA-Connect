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
  createFinanceEntry: vi.fn(),
  uploadFinanceReceipt: vi.fn(),
}));

vi.mock("../lib/events-api", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
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

function renderFinancePage(role: MemberRole = "treasurer") {
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
      <MemoryRouter>
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

  it("shows event budget vs actual for board members", async () => {
    const { fetchEventBudgetBreakdown, fetchExpenseByCategory, fetchFinanceSummary } =
      await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);

    renderFinancePage("board");

    expect(await screen.findByText("Event budget tracking")).toBeInTheDocument();
    expect(screen.getByText("Spend by category")).toBeInTheDocument();
    expect(screen.getByTestId("expense-category-chart")).toBeInTheDocument();
    expect(screen.getByTestId("event-budget-table")).toBeInTheDocument();
    expect(screen.getByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.queryByTestId("finance-running-balance")).not.toBeInTheDocument();
    expect(fetchFinanceSummary).not.toHaveBeenCalled();
    expect(fetchExpenseByCategory).toHaveBeenCalledWith(undefined);
  });

  it("shows running balance and budget breakdown for treasurer", async () => {
    const {
      fetchEventBudgetBreakdown,
      fetchExpenseByCategory,
      fetchFinanceSummary,
      fetchFinanceEntries,
      fetchPendingFinanceChangeRequests,
    } = await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);
    vi.mocked(fetchFinanceEntries).mockResolvedValue({ entries: [], total: 0 });
    vi.mocked(fetchPendingFinanceChangeRequests).mockResolvedValue({
      requests: [],
      total: 0,
    });

    renderFinancePage("treasurer");

    expect(await screen.findByTestId("finance-running-balance")).toHaveTextContent(
      "$260.00",
    );
    expect(screen.getByRole("heading", { name: "Log transaction" })).toBeInTheDocument();
    expect(screen.getByTestId("finance-entry-list")).toBeInTheDocument();
    expect(screen.getByText("Event budget vs actual")).toBeInTheDocument();
    expect(fetchEventBudgetBreakdown).toHaveBeenCalledWith(undefined);
    expect(fetchExpenseByCategory).toHaveBeenCalledWith(undefined);
    expect(fetchFinanceSummary).toHaveBeenCalledWith(undefined);
  });

  it("reloads charts when semester filter changes", async () => {
    const user = userEvent.setup();
    const { fetchEventBudgetBreakdown, fetchExpenseByCategory, fetchFinanceSummary } =
      await import("../lib/finance-api");
    vi.mocked(fetchEventBudgetBreakdown).mockResolvedValue(mockBudgetBreakdown);
    vi.mocked(fetchExpenseByCategory).mockResolvedValue(mockExpenseCategories);

    renderFinancePage("board");
    await screen.findByTestId("event-budget-table");

    const semesterSelect = screen.getByRole("combobox", { name: "Semester" });
    const firstSemesterOption = semesterSelect.querySelectorAll("option")[1];
    const semesterValue = firstSemesterOption?.getAttribute("value");

    expect(semesterValue).toBeTruthy();
    await user.selectOptions(semesterSelect, semesterValue!);

    await waitFor(() => {
      expect(fetchExpenseByCategory).toHaveBeenLastCalledWith({
        semester: semesterValue,
      });
      expect(fetchEventBudgetBreakdown).toHaveBeenLastCalledWith({
        semester: semesterValue,
      });
    });
    expect(fetchFinanceSummary).not.toHaveBeenCalled();
  });
});
