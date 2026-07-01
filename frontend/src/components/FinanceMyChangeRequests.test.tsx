import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinanceMyChangeRequests } from "./FinanceMyChangeRequests";

vi.mock("../lib/finance-api", () => ({
  fetchMyFinanceChangeRequests: vi.fn(),
}));

import { fetchMyFinanceChangeRequests } from "../lib/finance-api";

const mockedFetchMyFinanceChangeRequests = vi.mocked(fetchMyFinanceChangeRequests);

describe("FinanceMyChangeRequests", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows rejected requests with reviewer note", async () => {
    mockedFetchMyFinanceChangeRequests.mockResolvedValue({
      total: 1,
      summary: {
        pending_count: 0,
        recently_rejected_count: 1,
        recently_approved_count: 0,
      },
      requests: [
        {
          id: 4,
          entry_id: 9,
          action: "delete",
          status: "rejected",
          payload: null,
          requested_by_id: 2,
          requested_by_name: "Treasurer",
          reviewed_by_id: 3,
          reviewed_by_name: "President",
          review_note: "Keep this entry for audit",
          created_at: "2026-03-18T12:00:00Z",
          reviewed_at: "2026-03-18T13:00:00Z",
          entry_type: "expense",
          entry_amount: "65.00",
          entry_description: "Snacks",
        },
      ],
    });

    render(<FinanceMyChangeRequests />);

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Keep this entry for audit/)).toBeInTheDocument();
    expect(screen.getByText(/by President/)).toBeInTheDocument();
  });
});
