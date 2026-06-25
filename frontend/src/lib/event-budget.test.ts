import { describe, expect, it } from "vitest";

import {
  budgetStatusLabel,
  budgetUsagePercent,
  type EventBudgetRow,
} from "./event-budget";

const baseRow: EventBudgetRow = {
  event_id: 1,
  event_name: "Dashain Celebration",
  planned_budget: "250.00",
  actual_expense: "40.00",
  actual_income: "0.00",
  budget_remaining: "210.00",
  over_budget: false,
  entry_count: 1,
};

describe("event budget helpers", () => {
  it("calculates usage percent against planned budget", () => {
    expect(budgetUsagePercent("250.00", "125.00")).toBe(50);
    expect(budgetUsagePercent("250.00", "300.00")).toBe(100);
    expect(budgetUsagePercent("0.00", "50.00")).toBe(100);
  });

  it("labels budget status", () => {
    expect(budgetStatusLabel(baseRow)).toBe("Under budget");
    expect(
      budgetStatusLabel({
        ...baseRow,
        actual_expense: "0.00",
        budget_remaining: "250.00",
      }),
    ).toBe("No spending yet");
    expect(
      budgetStatusLabel({
        ...baseRow,
        actual_expense: "300.00",
        budget_remaining: "-50.00",
        over_budget: true,
      }),
    ).toBe("Over budget");
  });
});
