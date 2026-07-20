import { describe, expect, it } from "vitest";

import {
  FINANCE_APPROVALS_PATH,
  FINANCE_TRANSACTIONS_PATH,
  financeBooksPath,
  financeTabSearchParams,
  parseFinanceEventId,
  parseFinanceTab,
} from "./finance-routes";

describe("finance-routes", () => {
  it("parses finance tab query values including legacy aliases", () => {
    expect(parseFinanceTab(null)).toBe("pulse");
    expect(parseFinanceTab("pulse")).toBe("pulse");
    expect(parseFinanceTab("overview")).toBe("pulse");
    expect(parseFinanceTab("inbox")).toBe("inbox");
    expect(parseFinanceTab("approvals")).toBe("inbox");
    expect(parseFinanceTab("books")).toBe("books");
    expect(parseFinanceTab("transactions")).toBe("books");
    expect(parseFinanceTab("dues")).toBe("dues");
    expect(parseFinanceTab("invalid")).toBe("pulse");
  });

  it("parses event_id query values", () => {
    expect(parseFinanceEventId(null)).toBeNull();
    expect(parseFinanceEventId("")).toBeNull();
    expect(parseFinanceEventId("12")).toBe(12);
    expect(parseFinanceEventId("0")).toBeNull();
    expect(parseFinanceEventId("-3")).toBeNull();
    expect(parseFinanceEventId("abc")).toBeNull();
  });

  it("builds search params for tabs and optional books event filter", () => {
    expect(financeTabSearchParams("pulse")).toEqual({});
    expect(financeTabSearchParams("inbox")).toEqual({ tab: "inbox" });
    expect(financeTabSearchParams("books")).toEqual({ tab: "books" });
    expect(financeTabSearchParams("books", { eventId: 7 })).toEqual({
      tab: "books",
      event_id: "7",
    });
    expect(financeTabSearchParams("inbox", { eventId: 7 })).toEqual({
      tab: "inbox",
    });
    expect(FINANCE_APPROVALS_PATH).toBe("/finance?tab=inbox");
    expect(FINANCE_TRANSACTIONS_PATH).toBe("/finance?tab=books");
    expect(financeBooksPath()).toBe("/finance?tab=books");
    expect(financeBooksPath(7)).toBe("/finance?tab=books&event_id=7");
  });
});
