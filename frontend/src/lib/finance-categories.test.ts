import { describe, expect, it } from "vitest";

import { formatFinanceCategory } from "./finance-categories";

describe("formatFinanceCategory", () => {
  it("maps known categories to readable labels", () => {
    expect(formatFinanceCategory("food_beverage")).toBe("Food & beverage");
    expect(formatFinanceCategory("venue")).toBe("Venue");
  });
});
