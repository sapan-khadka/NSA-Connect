import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LogFinanceEntryForm } from "./LogFinanceEntryForm";

vi.mock("../lib/finance-api", () => ({
  createFinanceEntry: vi.fn(),
  uploadFinanceReceipt: vi.fn(),
}));

describe("LogFinanceEntryForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows custom category input when add your own is selected", async () => {
    const user = userEvent.setup();

    render(<LogFinanceEntryForm eventOptions={[]} onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "+ Log transaction" }));
    await user.selectOptions(screen.getByLabelText("Category"), "Add your own…");

    expect(screen.getByLabelText("Custom category")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Equipment rental")).toBeInTheDocument();
  });

  it("submits a normalized custom category", async () => {
    const user = userEvent.setup();
    const { createFinanceEntry } = await import("../lib/finance-api");
    const onCreated = vi.fn();
    vi.mocked(createFinanceEntry).mockResolvedValue({
      id: 1,
      entry_type: "expense",
      category: "speaker_fee",
      amount: "25.00",
      description: "Guest speaker",
      receipt_url: null,
      event_id: null,
      created_by_id: 1,
      created_at: "2030-01-01T00:00:00Z",
    });

    render(<LogFinanceEntryForm eventOptions={[]} onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "+ Log transaction" }));
    await user.selectOptions(screen.getByLabelText("Category"), "Add your own…");
    await user.type(screen.getByLabelText("Custom category"), "Speaker fee");
    await user.type(screen.getByLabelText("Amount"), "25");
    await user.type(screen.getByLabelText("Description"), "Guest speaker");
    await user.click(screen.getByRole("button", { name: "Log transaction" }));

    expect(createFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "speaker_fee",
        amount: "25.00",
      }),
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it("submits from standalone presentation without expand step", async () => {
    const user = userEvent.setup();
    const { createFinanceEntry } = await import("../lib/finance-api");
    const onCreated = vi.fn();
    vi.mocked(createFinanceEntry).mockResolvedValue({
      id: 1,
      entry_type: "expense",
      category: "food_beverage",
      amount: "12.00",
      description: "Snacks",
      receipt_url: null,
      event_id: null,
      created_by_id: 1,
      created_at: "2030-01-01T00:00:00Z",
    });

    render(
      <LogFinanceEntryForm
        eventOptions={[]}
        onCreated={onCreated}
        presentation="standalone"
        idPrefix="test"
      />,
    );

    await user.type(screen.getByLabelText("Amount"), "12");
    await user.type(screen.getByLabelText("Description"), "Snacks");
    await user.click(screen.getByRole("button", { name: "Log transaction" }));

    expect(createFinanceEntry).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalled();
  });
});
