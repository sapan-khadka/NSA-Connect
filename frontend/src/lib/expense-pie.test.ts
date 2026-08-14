import { describe, expect, it } from "vitest";

import {
  buildExpensePieSlices,
  pieSlicePath,
} from "./expense-pie";

describe("buildExpensePieSlices", () => {
  it("builds percent-weighted slices from category totals", () => {
    const slices = buildExpensePieSlices(
      [
        { category: "venue", total_expense: "100.00", entry_count: 1 },
        { category: "food_beverage", total_expense: "65.00", entry_count: 2 },
      ],
      "165.00",
    );

    expect(slices).toHaveLength(2);
    expect(slices[0]?.key).toBe("venue");
    expect(slices[0]?.percent).toBe(61);
    expect(slices[0]?.color).toBe("#2563eb");
    expect(slices[0]?.startAngle).toBe(0);
    expect(slices[1]?.endAngle).toBe(360);
    expect(slices[1]?.label).toBe("Food & beverage");
  });

  it("returns empty when there is nothing to chart", () => {
    expect(buildExpensePieSlices([], "0.00")).toEqual([]);
    expect(
      buildExpensePieSlices(
        [{ category: "other", total_expense: "0.00", entry_count: 0 }],
        "0.00",
      ),
    ).toEqual([]);
  });
});

describe("pieSlicePath", () => {
  it("draws a closed wedge", () => {
    const path = pieSlicePath(80, 80, 70, 0, 90);
    expect(path.startsWith("M 80 80")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("A 70 70");
  });
});
