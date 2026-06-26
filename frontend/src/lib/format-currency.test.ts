import { describe, expect, it } from "vitest";

import {
  currencyBalanceToneClass,
  formatCurrency,
  parseCurrencyAmount,
} from "./format-currency";

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

describe("currencyBalanceToneClass", () => {
  it("maps positive, negative, and zero balances to tone classes", () => {
    expect(currencyBalanceToneClass("10.00")).toBe("text-emerald-700");
    expect(currencyBalanceToneClass("-5.00")).toBe("text-red-700");
    expect(currencyBalanceToneClass("0.00")).toBe("text-primary");
  });
});
