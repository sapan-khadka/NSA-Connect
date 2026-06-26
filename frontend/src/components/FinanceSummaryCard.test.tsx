import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FinanceSummaryCard } from "./FinanceSummaryCard";

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
      />,
    );

    expect(screen.getByTestId("finance-running-balance")).toHaveTextContent(
      "$260.00",
    );
    expect(screen.getByTestId("finance-total-income")).toHaveTextContent(
      "$300.00",
    );
    expect(screen.getByTestId("finance-total-expense")).toHaveTextContent(
      "$40.00",
    );
    expect(screen.getByText("Transaction breakdown")).toBeInTheDocument();
    expect(screen.getByText("Dashain Celebration")).toBeInTheDocument();
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
