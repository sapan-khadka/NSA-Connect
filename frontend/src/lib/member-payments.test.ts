import { describe, expect, it } from "vitest";

import type { MemberPaymentRecord } from "./member-payments";
import {
  computeDuesStatus,
  computeMemberPaymentsSummary,
  outstandingFromAmounts,
  paymentProgressPercent,
  semesterDuesDueDate,
} from "./member-payments";

function record(
  partial: Partial<MemberPaymentRecord> &
    Pick<MemberPaymentRecord, "id" | "semester" | "status">,
): MemberPaymentRecord {
  return {
    amountOwed: "20.00",
    amountPaid: "0.00",
    paidAt: null,
    paymentMethod: null,
    note: null,
    ...partial,
  };
}

describe("outstandingFromAmounts", () => {
  it("matches dashboard max(owed - paid, 0)", () => {
    expect(outstandingFromAmounts("20.00", "0.00")).toBe(20);
    expect(outstandingFromAmounts("20.00", "5.00")).toBe(15);
    expect(outstandingFromAmounts("20.00", "20.00")).toBe(0);
    expect(outstandingFromAmounts("20.00", "25.00")).toBe(0);
  });
});

describe("computeDuesStatus", () => {
  it("mirrors backend status rules", () => {
    expect(computeDuesStatus("0.00", "0.00")).toBe("exempt");
    expect(computeDuesStatus("20.00", "20.00")).toBe("paid");
    expect(computeDuesStatus("20.00", "5.00")).toBe("partial");
    expect(computeDuesStatus("20.00", "0.00")).toBe("unpaid");
  });
});

describe("paymentProgressPercent", () => {
  it("uses paid / owed for progress fill", () => {
    expect(paymentProgressPercent("20.00", "0.00")).toBe(0);
    expect(paymentProgressPercent("20.00", "10.00")).toBe(50);
    expect(paymentProgressPercent("20.00", "20.00")).toBe(100);
    expect(paymentProgressPercent("0.00", "0.00", "exempt")).toBe(100);
  });
});

describe("semesterDuesDueDate", () => {
  it("maps semester slugs to conventional due dates", () => {
    expect(semesterDuesDueDate("2026-spring")).toBe("2026-02-15");
    expect(semesterDuesDueDate("2026-summer")).toBe("2026-06-15");
    expect(semesterDuesDueDate("2026-fall")).toBe("2026-09-15");
  });
});

describe("computeMemberPaymentsSummary", () => {
  it("aggregates balance, outstanding, status, due date, and history", () => {
    const records = [
      record({
        id: 1,
        semester: "2026-fall",
        status: "partial",
        amountOwed: "20.00",
        amountPaid: "5.00",
      }),
      record({
        id: 2,
        semester: "2026-spring",
        status: "paid",
        amountOwed: "20.00",
        amountPaid: "20.00",
        paidAt: "2026-02-01T12:00:00Z",
        paymentMethod: "venmo",
      }),
    ];

    const summary = computeMemberPaymentsSummary(records, "2026-fall");

    expect(summary.currentBalance).toBe(15);
    expect(summary.outstandingAmount).toBe(15);
    expect(summary.paymentStatus).toBe("partial");
    expect(summary.paymentStatusLabel).toBe("Partial");
    expect(summary.progressPercent).toBe(25);
    expect(summary.nextDueDate).toBe("2026-09-15");
    expect(summary.history).toHaveLength(2);
    expect(summary.hasRecords).toBe(true);
  });

  it("returns empty indicators when there are no records", () => {
    const summary = computeMemberPaymentsSummary([], "2026-fall");
    expect(summary.hasRecords).toBe(false);
    expect(summary.currentBalance).toBe(0);
    expect(summary.outstandingAmount).toBe(0);
    expect(summary.paymentStatus).toBeNull();
    expect(summary.nextDueLabel).toBe("—");
  });
});
