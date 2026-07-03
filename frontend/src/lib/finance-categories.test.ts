import { describe, expect, it } from "vitest";

import {
  CUSTOM_FINANCE_CATEGORY,
  financeCategoryToFormValue,
  formatFinanceCategory,
  normalizeCustomFinanceCategory,
  resolveFinanceCategoryForSubmit,
  validateCustomFinanceCategory,
} from "./finance-categories";

describe("finance-categories", () => {
  it("formats preset and custom categories", () => {
    expect(formatFinanceCategory("food_beverage")).toBe("Food & beverage");
    expect(formatFinanceCategory("equipment_rental")).toBe("Equipment Rental");
  });

  it("normalizes custom category labels for storage", () => {
    expect(normalizeCustomFinanceCategory("Equipment Rental")).toBe(
      "equipment_rental",
    );
  });

  it("resolves custom category submission values", () => {
    expect(
      resolveFinanceCategoryForSubmit(CUSTOM_FINANCE_CATEGORY, "Speaker fee"),
    ).toBe("speaker_fee");
    expect(resolveFinanceCategoryForSubmit("venue", "")).toBe("venue");
  });

  it("maps stored custom categories back to form values", () => {
    expect(financeCategoryToFormValue("equipment_rental")).toEqual({
      category: CUSTOM_FINANCE_CATEGORY,
      customCategory: "Equipment Rental",
    });
    expect(financeCategoryToFormValue("venue")).toEqual({
      category: "venue",
      customCategory: "",
    });
  });

  it("validates custom category input", () => {
    expect(validateCustomFinanceCategory("")).toBe("Enter a category name");
    expect(validateCustomFinanceCategory("AB")).toBeNull();
  });
});
