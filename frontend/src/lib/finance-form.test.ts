import { describe, expect, it } from "vitest";

import {
  initialLogFinanceEntryValues,
  validateLogFinanceEntryForm,
} from "./finance-form";

describe("validateLogFinanceEntryForm", () => {
  it("requires a positive amount with up to two decimals", () => {
    expect(
      validateLogFinanceEntryForm({
        ...initialLogFinanceEntryValues,
        amount: "",
      }).amount,
    ).toBeTruthy();

    expect(
      validateLogFinanceEntryForm({
        ...initialLogFinanceEntryValues,
        amount: "25.50",
      }),
    ).toEqual({});
  });
});
