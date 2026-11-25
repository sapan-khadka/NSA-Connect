import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LogFinanceEntryForm } from "./LogFinanceEntryForm";

vi.mock("../lib/finance-api", () => ({
  createFinanceEntry: vi.fn(),
  uploadFinanceReceipt: vi.fn(),
  scanFinanceReceipt: vi.fn(),
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

  it("locks the event picker and submits with lockedEventId", async () => {
    const user = userEvent.setup();
    const { createFinanceEntry } = await import("../lib/finance-api");
    const onCreated = vi.fn();
    vi.mocked(createFinanceEntry).mockResolvedValue({
      id: 2,
      entry_type: "expense",
      category: "venue",
      amount: "40.00",
      description: "Hall deposit",
      receipt_url: null,
      event_id: 9,
      created_by_id: 1,
      created_at: "2030-01-01T00:00:00Z",
    });

    render(
      <LogFinanceEntryForm
        eventOptions={[{ id: 9, name: "Dashain Celebration" }]}
        lockedEventId={9}
        lockedEventName="Dashain Celebration"
        onCreated={onCreated}
        presentation="standalone"
        idPrefix="locked"
      />,
    );

    expect(screen.getByTestId("log-finance-locked-event")).toHaveTextContent(
      "Dashain Celebration",
    );
    expect(screen.queryByLabelText("Linked event")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Category"), "venue");
    await user.type(screen.getByLabelText("Amount"), "40");
    await user.type(screen.getByLabelText("Description"), "Hall deposit");
    await user.click(screen.getByRole("button", { name: "Log transaction" }));

    expect(createFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 9,
        amount: "40.00",
        category: "venue",
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

  it("requests the rear camera for Take photo and a file picker for Upload file", () => {
    render(
      <LogFinanceEntryForm
        eventOptions={[]}
        onCreated={vi.fn()}
        presentation="standalone"
        idPrefix="picker"
      />,
    );

    const camera = document.getElementById("picker-receipt-camera") as HTMLInputElement;
    const upload = document.getElementById("picker-receipt") as HTMLInputElement;

    expect(camera).toHaveAttribute("accept", "image/*");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera.closest("label")).toHaveTextContent("Take photo");
    expect(camera.closest("label")).toHaveAttribute("for", "picker-receipt-camera");

    expect(upload).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,application/pdf",
    );
    expect(upload).not.toHaveAttribute("capture");
    expect(upload.closest("label")).toHaveTextContent("Upload file");
    expect(upload.closest("label")).toHaveAttribute("for", "picker-receipt");
  });

  it("auto-scans a camera photo and leaves an uploaded file for manual scan", async () => {
    const user = userEvent.setup();
    const { scanFinanceReceipt } = await import("../lib/finance-api");
    vi.mocked(scanFinanceReceipt).mockResolvedValue({
      readable: true,
      vendor: null,
      purchase_date: null,
      purchase_time: null,
      amount: "8.00",
      description: "Tea",
      category: null,
      confidence: "medium",
    });

    render(
      <LogFinanceEntryForm
        eventOptions={[]}
        onCreated={vi.fn()}
        presentation="standalone"
        idPrefix="source"
      />,
    );

    const camera = document.getElementById("source-receipt-camera") as HTMLInputElement;
    await user.upload(
      camera,
      new File(["jpeg"], "shot.jpg", { type: "image/jpeg" }),
    );

    await waitFor(() => {
      expect(scanFinanceReceipt).toHaveBeenCalledTimes(1);
    });

    const upload = document.getElementById("source-receipt") as HTMLInputElement;
    await user.upload(
      upload,
      new File(["pdf"], "receipt.pdf", { type: "application/pdf" }),
    );

    expect(scanFinanceReceipt).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/receipt\.pdf/)).toBeInTheDocument();
  });

  it("pre-fills fields from a successful receipt scan without auto-submitting", async () => {
    const user = userEvent.setup();
    const { scanFinanceReceipt, createFinanceEntry } = await import(
      "../lib/finance-api"
    );
    vi.mocked(scanFinanceReceipt).mockResolvedValue({
      readable: true,
      vendor: "Walmart",
      purchase_date: "2026-03-15",
      purchase_time: "14:32",
      amount: "24.67",
      description: "Walmart: Milk, bread, eggs (purchased 2026-03-15)",
      category: "food_beverage",
      confidence: "high",
    });

    render(
      <LogFinanceEntryForm
        eventOptions={[]}
        onCreated={vi.fn()}
        presentation="standalone"
        idPrefix="scan"
      />,
    );

    const file = new File(["fake-image"], "receipt.jpg", { type: "image/jpeg" });
    const uploadInput = document.getElementById("scan-receipt") as HTMLInputElement;
    await user.upload(uploadInput, file);

    await user.click(screen.getByRole("button", { name: "Scan receipt" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Amount")).toHaveValue("24.67");
    });
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Walmart: Milk, bread, eggs (purchased 2026-03-15)",
    );
    expect(screen.getByLabelText("Category")).toHaveValue("food_beverage");
    expect(
      screen.getByText(/Receipt details filled in/i),
    ).toBeInTheDocument();
    expect(createFinanceEntry).not.toHaveBeenCalled();
  });

  it("falls back to manual entry when the receipt cannot be read", async () => {
    const user = userEvent.setup();
    const { scanFinanceReceipt, createFinanceEntry } = await import(
      "../lib/finance-api"
    );
    vi.mocked(scanFinanceReceipt).mockResolvedValue({
      readable: false,
      vendor: null,
      purchase_date: null,
      purchase_time: null,
      amount: null,
      description: null,
      category: null,
      confidence: "low",
    });

    render(
      <LogFinanceEntryForm
        eventOptions={[]}
        onCreated={vi.fn()}
        presentation="standalone"
        idPrefix="blurry"
      />,
    );

    const file = new File(["blurry"], "blurry.jpg", { type: "image/jpeg" });
    const uploadInput = document.getElementById("blurry-receipt") as HTMLInputElement;
    await user.upload(uploadInput, file);
    await user.click(screen.getByRole("button", { name: "Scan receipt" }));

    expect(
      await screen.findByText(/Couldn't read that receipt clearly/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("");
    expect(createFinanceEntry).not.toHaveBeenCalled();
    expect(screen.getByText(/Attached:/i)).toBeInTheDocument();
  });

  it("keeps the photo attached and allows manual save after scan API failure", async () => {
    const user = userEvent.setup();
    const { scanFinanceReceipt, createFinanceEntry, uploadFinanceReceipt } =
      await import("../lib/finance-api");
    vi.mocked(scanFinanceReceipt).mockRejectedValue(new Error("timeout"));
    vi.mocked(uploadFinanceReceipt).mockResolvedValue({
      receipt_url: "https://cdn.example/receipt.jpg",
      public_id: "receipts/1",
      bytes: 12,
      format: "jpg",
      resource_type: "image",
    });
    vi.mocked(createFinanceEntry).mockResolvedValue({
      id: 9,
      entry_type: "expense",
      category: "other",
      amount: "5.00",
      description: "Manual entry",
      receipt_url: "https://cdn.example/receipt.jpg",
      event_id: null,
      created_by_id: 1,
      created_at: "2030-01-01T00:00:00Z",
    });

    render(
      <LogFinanceEntryForm
        eventOptions={[]}
        onCreated={vi.fn()}
        presentation="standalone"
        idPrefix="fail"
      />,
    );

    const file = new File(["x"], "fail.jpg", { type: "image/jpeg" });
    const uploadInput = document.getElementById("fail-receipt") as HTMLInputElement;
    await user.upload(uploadInput, file);
    await user.click(screen.getByRole("button", { name: "Scan receipt" }));

    expect(
      await screen.findByText(/Couldn't read that receipt clearly/i),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Category"), "other");
    await user.type(screen.getByLabelText("Amount"), "5");
    await user.type(screen.getByLabelText("Description"), "Manual entry");
    await user.click(screen.getByRole("button", { name: "Log transaction" }));

    await waitFor(() => {
      expect(uploadFinanceReceipt).toHaveBeenCalled();
      expect(createFinanceEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "5.00",
          receipt_url: "https://cdn.example/receipt.jpg",
        }),
      );
    });
  });
});
