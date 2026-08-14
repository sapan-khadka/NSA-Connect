import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ExpenseCategoryChart } from "./ExpenseCategoryChart";

const categories = [
  { category: "food_beverage", total_expense: "65.00", entry_count: 2 },
  { category: "venue", total_expense: "100.00", entry_count: 1 },
];

describe("ExpenseCategoryChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a pie chart with slices and legend", () => {
    render(
      <ExpenseCategoryChart
        categories={categories}
        totalExpense="165.00"
        isLoading={false}
        errorMessage={null}
      />,
    );

    expect(screen.getByText("Spend by category")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Spend by category pie chart" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("expense-slice-venue")).toBeInTheDocument();
    expect(screen.getByTestId("expense-slice-food_beverage")).toBeInTheDocument();
    expect(screen.getByText("Food & beverage")).toBeInTheDocument();
    expect(screen.getAllByText("$100").length).toBeGreaterThan(0);
    expect(screen.getByText("Total spent")).toBeInTheDocument();
  });

  it("selects a slice from the legend and updates the center label", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseCategoryChart
        categories={categories}
        totalExpense="165.00"
        isLoading={false}
        errorMessage={null}
      />,
    );

    const venueLegend = screen.getByTestId("expense-legend-venue");
    await user.click(venueLegend);
    expect(venueLegend).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("expense-slice-venue")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows empty state when there are no expenses", () => {
    render(
      <ExpenseCategoryChart
        categories={[]}
        totalExpense="0.00"
        isLoading={false}
        errorMessage={null}
      />,
    );

    expect(
      screen.getByText("No expenses logged for this period."),
    ).toBeInTheDocument();
  });
});
