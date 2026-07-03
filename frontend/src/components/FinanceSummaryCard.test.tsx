import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  FinanceSummaryCard,
  FinanceSummaryMetrics,
} from "./FinanceSummaryCard";

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

describe("FinanceSummaryCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders treasury totals and transaction breakdown", () => {
    render(
      <FinanceSummaryCard
        isLoading={false}
        errorMessage={null}
        summary={mockSummary}
        pendingCount={2}
      />,
    );

    expect(screen.getByTestId("finance-net-balance-amount")).toHaveTextContent(
      "$260.00",
    );
    expect(screen.getByTestId("finance-total-income-amount")).toHaveTextContent(
      "$300.00",
    );
    expect(screen.getByTestId("finance-total-expense-amount")).toHaveTextContent(
      "$40.00",
    );
    expect(screen.getByTestId("finance-pending-count")).toHaveTextContent("2 requests");
    expect(screen.getByText("Transaction breakdown")).toBeInTheDocument();
    expect(screen.getByText("Dashain Celebration")).toBeInTheDocument();
  });

  it("highlights net balance only when the value is notable", () => {
    render(
      <FinanceSummaryMetrics
        isLoading={false}
        errorMessage={null}
        summary={mockSummary}
      />,
    );

    const incomeCard = screen.getByTestId("finance-total-income").closest("section");
    const netBalanceCard = screen.getByTestId("finance-net-balance").closest("section");

    expect(incomeCard).toHaveClass("border-gray-200");
    expect(netBalanceCard).toHaveClass("bg-mint/25");
  });

  it("uses warning styling for negative net balance", () => {
    render(
      <FinanceSummaryMetrics
        isLoading={false}
        errorMessage={null}
        summary={{
          ...mockSummary,
          balance: "-15.00",
          total_income: "0.00",
          total_expense: "15.00",
        }}
      />,
    );

    const netBalanceCard = screen.getByTestId("finance-net-balance").closest("section");
    expect(netBalanceCard).toHaveClass("bg-overdue-surface");
    expect(screen.getByTestId("finance-net-balance-amount")).toHaveClass("text-overdue");
    expect(screen.getByText("Spending with no income yet")).toBeInTheDocument();
  });

  it("shows loading and error states", () => {
    const { rerender } = render(
      <FinanceSummaryCard isLoading errorMessage={null} summary={null} />,
    );

    expect(screen.getByText("Loading finance summary...")).toBeInTheDocument();

    rerender(
      <FinanceSummaryCard
        isLoading={false}
        errorMessage="Unable to load finance summary."
        summary={null}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load finance summary.",
    );
  });
});
