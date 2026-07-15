import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { buildFinancialStatusSummary } from "../../lib/member-workspace-financial";
import { MemberWorkspaceFinancialStatus } from "./MemberWorkspaceFinancialStatus";

describe("MemberWorkspaceFinancialStatus", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders dues status and lifetime contributions", () => {
    const summary = buildFinancialStatusSummary({
      currentSemester: "2026-spring",
      records: [
        {
          id: 1,
          member_id: 2,
          semester: "2025-fall",
          amount_owed: "20.00",
          amount_paid: "20.00",
          status: "paid",
          paid_at: "2025-09-01T00:00:00Z",
        },
        {
          id: 2,
          member_id: 2,
          semester: "2026-spring",
          amount_owed: "25.00",
          amount_paid: "5.00",
          status: "partial",
          paid_at: "2026-02-01T00:00:00Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <MemberWorkspaceFinancialStatus summary={summary} />
      </MemoryRouter>,
    );

    const section = screen.getByLabelText("Financial Status");
    expect(
      within(section).getByRole("heading", { name: "Financial Status" }),
    ).toBeInTheDocument();
    expect(within(section).getByText(/Outstanding:/)).toBeInTheDocument();
    expect(within(section).getByText("$25.00")).toBeInTheDocument();
  });

  it("shows empty state when there is no history", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceFinancialStatus
          summary={buildFinancialStatusSummary({
            currentSemester: "2026-fall",
            records: [],
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("No dues on record yet.")).toBeInTheDocument();
  });
});
