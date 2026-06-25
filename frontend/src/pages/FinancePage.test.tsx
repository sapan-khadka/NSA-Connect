import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";

import { FinancePage } from "./FinancePage";

vi.mock("../lib/finance-api", () => ({
  fetchFinanceSummary: vi.fn(),
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

function renderFinancePage(role: "treasurer" | "president" = "treasurer") {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "Treasury User",
          email: "treasurer@semo.edu",
          student_id: "55443322",
          major: "Administration",
          graduation_year: 2028,
          role,
          status: "approved",
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

  it("shows running balance, income, expense, and net balance", async () => {
    const { fetchFinanceSummary } = await import("../lib/finance-api");
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);

    renderFinancePage();

    expect(await screen.findByTestId("finance-running-balance")).toHaveTextContent(
      "$260.00",
    );
    expect(screen.getByTestId("finance-total-income")).toHaveTextContent("$300.00");
    expect(screen.getByTestId("finance-total-expense")).toHaveTextContent("$40.00");
    expect(screen.getByTestId("finance-net-balance")).toHaveTextContent("$260.00");
  });

  it("loads all-time summary by default", async () => {
    const { fetchFinanceSummary } = await import("../lib/finance-api");
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);

    renderFinancePage();

    await screen.findByTestId("finance-running-balance");

    expect(fetchFinanceSummary).toHaveBeenCalledWith(undefined);
  });

  it("reloads summary when semester filter changes", async () => {
    const user = userEvent.setup();
    const { fetchFinanceSummary } = await import("../lib/finance-api");
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);

    renderFinancePage();
    await screen.findByTestId("finance-running-balance");

    const semesterSelect = screen.getByRole("combobox", { name: "Semester" });
    const firstSemesterOption = semesterSelect.querySelectorAll("option")[1];
    const semesterValue = firstSemesterOption?.getAttribute("value");

    expect(semesterValue).toBeTruthy();
    await user.selectOptions(semesterSelect, semesterValue!);

    await waitFor(() => {
      expect(fetchFinanceSummary).toHaveBeenLastCalledWith({
        semester: semesterValue,
      });
    });
  });

  it("shows event and pre-event breakdown rows", async () => {
    const { fetchFinanceSummary } = await import("../lib/finance-api");
    vi.mocked(fetchFinanceSummary).mockResolvedValue(mockSummary);

    renderFinancePage();

    expect(await screen.findByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByText("Pre-event / general")).toBeInTheDocument();
    expect(screen.getByText("3 entries in this view")).toBeInTheDocument();
  });
});
