import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FinanceChangeRequestResponse,
  FinanceEntryResponse,
} from "../lib/finance-api";

vi.mock("../lib/finance-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/finance-api")>(
    "../lib/finance-api",
  );
  return {
    ...actual,
    fetchFinanceEntries: vi.fn(),
    updateFinanceEntry: vi.fn(),
    deleteFinanceEntry: vi.fn(),
  };
});

import {
  deleteFinanceEntry,
  fetchFinanceEntries,
  updateFinanceEntry,
} from "../lib/finance-api";
import { FinanceEntryList } from "./FinanceEntryList";

const mockedFetch = vi.mocked(fetchFinanceEntries);
const mockedUpdate = vi.mocked(updateFinanceEntry);
const mockedDelete = vi.mocked(deleteFinanceEntry);

function makeEntry(overrides: Partial<FinanceEntryResponse> = {}): FinanceEntryResponse {
  return {
    id: 1,
    entry_type: "expense",
    category: "food_beverage",
    amount: "65.00",
    description: "Snacks",
    receipt_url: null,
    event_id: null,
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
    ...overrides,
  };
}

function makeChangeRequest(
  overrides: Partial<FinanceChangeRequestResponse> = {},
): FinanceChangeRequestResponse {
  return {
    id: 10,
    entry_id: 1,
    action: "update",
    status: "pending",
    payload: null,
    requested_by_id: 1,
    requested_by_name: "Treasurer",
    reviewed_by_id: null,
    reviewed_by_name: null,
    review_note: null,
    created_at: "2026-03-18T12:00:00Z",
    reviewed_at: null,
    entry_type: "expense",
    entry_amount: "65.00",
    entry_description: "Snacks",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("FinanceEntryList management", () => {
  it("hides actions when canManage is false", async () => {
    mockedFetch.mockResolvedValue({ entries: [makeEntry()], total: 1 });

    render(<FinanceEntryList semester="all" refreshKey={0} />);

    await waitFor(() =>
      expect(screen.getByText("Snacks")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("submits an edit for approval instead of applying immediately", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ entries: [makeEntry()], total: 1 });
    mockedUpdate.mockResolvedValue(makeChangeRequest({ action: "update" }));
    const onChanged = vi.fn();

    render(
      <FinanceEntryList
        semester="all"
        refreshKey={0}
        canManage
        onChanged={onChanged}
      />,
    );

    await waitFor(() => expect(screen.getByText("Snacks")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const amountInput = screen.getByLabelText("Edit amount");
    await user.clear(amountInput);
    await user.type(amountInput, "80.00");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(1, {
        entry_type: "expense",
        category: "food_beverage",
        amount: "80.00",
        description: "Snacks",
      }),
    );
    expect(onChanged).toHaveBeenCalled();
    expect(
      await screen.findByText(/submitted for approval/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Snacks")).toBeInTheDocument();
  });

  it("validates the amount before saving", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ entries: [makeEntry()], total: 1 });

    render(<FinanceEntryList semester="all" refreshKey={0} canManage />);

    await waitFor(() => expect(screen.getByText("Snacks")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const amountInput = screen.getByLabelText("Edit amount");
    await user.clear(amountInput);
    await user.type(amountInput, "0");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/valid amount greater than 0/i),
    ).toBeInTheDocument();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("submits a delete request for approval", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ entries: [makeEntry()], total: 1 });
    mockedDelete.mockResolvedValue(makeChangeRequest({ action: "delete" }));
    const onChanged = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <FinanceEntryList
        semester="all"
        refreshKey={0}
        canManage
        onChanged={onChanged}
      />,
    );

    await waitFor(() => expect(screen.getByText("Snacks")).toBeInTheDocument());

    const table = screen.getByTestId("finance-entry-list");
    await user.click(within(table).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(1));
    expect(onChanged).toHaveBeenCalled();
    expect(
      await screen.findByText(/delete request submitted for approval/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Snacks")).toBeInTheDocument();
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ entries: [makeEntry()], total: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<FinanceEntryList semester="all" refreshKey={0} canManage />);

    await waitFor(() => expect(screen.getByText("Snacks")).toBeInTheDocument());

    const table = screen.getByTestId("finance-entry-list");
    await user.click(within(table).getByRole("button", { name: "Delete" }));

    expect(mockedDelete).not.toHaveBeenCalled();
  });
});
