import { describe, expect, it } from "vitest";

import { formatCurrency, parseCurrencyAmount } from "./format-currency";

describe("formatCurrency", () => {
  it("formats decimal strings as USD", () => {
    expect(formatCurrency("260.00")).toBe("$260.00");
    expect(formatCurrency("40.5")).toBe("$40.50");
  });

  it("parses currency amounts safely", () => {
    expect(parseCurrencyAmount("260.00")).toBe(260);
    expect(parseCurrencyAmount("invalid")).toBe(0);
  });
});
