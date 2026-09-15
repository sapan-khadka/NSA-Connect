import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportFinanceCsvPanel } from "./ImportFinanceCsvPanel";
import { importFinanceCsv } from "../lib/finance-api";

vi.mock("../lib/finance-api", () => ({
  importFinanceCsv: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ImportFinanceCsvPanel", () => {
  it("previews a CSV then confirms import", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();

    vi.mocked(importFinanceCsv)
      .mockResolvedValueOnce({
        rows_created: 0,
        rows_ready: 1,
        rows_skipped: 1,
        skipped_rows: [
          {
            row_number: 10,
            reason: "Skipped total or summary row",
            raw_excerpt: "Teej Total",
          },
        ],
        preview_rows: [
          {
            row_number: 6,
            date: "2026-09-10T00:00:00+00:00",
            entry_type: "expense",
            category: "food_beverage",
            amount: "63.52",
            description: "Wamart Supercenter (qty 21)",
            event_id: 2,
            event_title: "Teej",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows_created: 1,
        rows_ready: 1,
        rows_skipped: 1,
        skipped_rows: [
          {
            row_number: 10,
            reason: "Skipped total or summary row",
            raw_excerpt: "Teej Total",
          },
        ],
        preview_rows: [],
      });

    render(<ImportFinanceCsvPanel onImported={onImported} />);

    const file = new File(
      ["Date,Category,Quantity,Event,Vendor,Price\n"],
      "expenses.csv",
      { type: "text/csv" },
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/ready to import/)).toBeInTheDocument();
    });
    expect(importFinanceCsv).toHaveBeenCalledWith(file, { dryRun: true });
    expect(screen.getByText("Teej")).toBeInTheDocument();
    expect(screen.getByText("$63.52")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm import" }));

    await waitFor(() => {
      expect(screen.getByText("Expense import complete")).toBeInTheDocument();
    });
    expect(importFinanceCsv).toHaveBeenCalledWith(file, { dryRun: false });
    expect(onImported).toHaveBeenCalledOnce();
    expect(screen.getByText(/entries created/)).toBeInTheDocument();
  });
});
