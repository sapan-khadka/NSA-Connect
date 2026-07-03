import { cleanup, render, screen } from "@testing-library/react";
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

  it("renders horizontal bars scaled to total expense", () => {
    render(
      <ExpenseCategoryChart
        categories={categories}
        totalExpense="165.00"
        isLoading={false}
        errorMessage={null}
      />,
    );

    expect(screen.getByText("Spend by category")).toBeInTheDocument();
    expect(screen.getByText("Food & beverage")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByTestId("expense-bar-venue")).toHaveStyle({ width: "61%" });
    expect(screen.getByTestId("expense-bar-food_beverage")).toHaveStyle({
      width: "39%",
    });
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
