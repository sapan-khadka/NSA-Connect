import { describe, expect, it } from "vitest";

import type { MemberDuesHistoryItem } from "./dues-api";
import {
  buildFinancialStatusSummary,
  sumLifetimeContributions,
} from "./member-workspace-financial";

function row(
  overrides: Partial<MemberDuesHistoryItem> &
    Pick<MemberDuesHistoryItem, "id" | "semester">,
): MemberDuesHistoryItem {
  return {
    member_id: 2,
    amount_owed: "20.00",
    amount_paid: "0.00",
    status: "unpaid",
    paid_at: null,
    ...overrides,
  };
}

describe("member-workspace-financial", () => {
  it("sums lifetime contributions across semesters", () => {
    expect(
      sumLifetimeContributions([
        row({ id: 1, semester: "2025-fall", amount_paid: "20.00", status: "paid" }),
        row({
          id: 2,
          semester: "2026-spring",
          amount_paid: "10.00",
          status: "partial",
        }),
      ]),
    ).toBe(30);
  });

  it("builds outstanding current status and lifetime label", () => {
    const summary = buildFinancialStatusSummary({
      currentSemester: "2026-spring",
      records: [
        row({ id: 1, semester: "2025-fall", amount_paid: "20.00", status: "paid" }),
        row({
          id: 2,
          semester: "2026-spring",
          amount_owed: "25.00",
          amount_paid: "5.00",
          status: "partial",
        }),
      ],
    });

    expect(summary.hasHistory).toBe(true);
    expect(summary.currentTone).toBe("outstanding");
    expect(summary.outstandingLabel).toMatch(/Outstanding:/);
    expect(summary.lifetimeLabel).toBe("$25.00");
  });

  it("uses a neutral empty state when there is no history", () => {
    const summary = buildFinancialStatusSummary({
      currentSemester: "2026-fall",
      records: [],
    });
    expect(summary.hasHistory).toBe(false);
    expect(summary.lifetimeContributions).toBeNull();
    expect(summary.currentStatusLabel).toBe("No dues on record");
  });
});
