import { describe, expect, it } from "vitest";

import { formatMyDuesStatus } from "./dues";

describe("formatMyDuesStatus", () => {
  it("returns null when no dues record exists", () => {
    expect(
      formatMyDuesStatus({
        semester: "2026-fall",
        amount_owed: null,
        amount_paid: null,
        status: null,
        has_record: false,
      }),
    ).toBeNull();
  });

  it("formats paid status", () => {
    expect(
      formatMyDuesStatus({
        semester: "2026-fall",
        amount_owed: "20.00",
        amount_paid: "20.00",
        status: "paid",
        has_record: true,
      }),
    ).toBe("Dues: Paid for Fall 2026");
  });

  it("formats unpaid status", () => {
    expect(
      formatMyDuesStatus({
        semester: "2026-fall",
        amount_owed: "20.00",
        amount_paid: "0.00",
        status: "unpaid",
        has_record: true,
      }),
    ).toBe("Dues: $20.00 outstanding for Fall 2026");
  });
});
