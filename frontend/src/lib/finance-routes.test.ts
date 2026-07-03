import { describe, expect, it } from "vitest";

import {
  FINANCE_APPROVALS_PATH,
  financeTabSearchParams,
  parseFinanceTab,
} from "./finance-routes";

describe("finance-routes", () => {
  it("parses finance tab query values", () => {
    expect(parseFinanceTab(null)).toBe("overview");
    expect(parseFinanceTab("approvals")).toBe("approvals");
    expect(parseFinanceTab("transactions")).toBe("transactions");
    expect(parseFinanceTab("invalid")).toBe("overview");
  });

  it("builds search params for non-overview tabs", () => {
    expect(financeTabSearchParams("overview")).toEqual({});
    expect(financeTabSearchParams("approvals")).toEqual({ tab: "approvals" });
    expect(FINANCE_APPROVALS_PATH).toBe("/finance?tab=approvals");
  });
});
