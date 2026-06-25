import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";

import { BoardDashboardPage } from "./BoardDashboardPage";

vi.mock("../lib/members-api", () => ({
  fetchPendingMembers: vi.fn(),
  approveMember: vi.fn(),
  rejectMember: vi.fn(),
}));

const pendingMember: MemberResponse = {
  id: 2,
  full_name: "Pending User",
  email: "pending@semo.edu",
  student_id: "S12345678",
  major: "Biology",
  graduation_year: 2027,
  role: "general",
  status: "pending",
};

function renderBoardDashboard() {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "Board User",
          email: "board@semo.edu",
          student_id: "87654321",
          major: "Administration",
          graduation_year: 2028,
          role: "board",
          status: "approved",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter>
        <BoardDashboardPage />
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("BoardDashboardPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the pending approval queue on the dashboard", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [pendingMember],
      total: 1,
    });

    renderBoardDashboard();

    expect(await screen.findByText("Pending User")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("pending-approval-count")).toHaveTextContent(
        "1",
      );
    });
    expect(
      screen.getByRole("button", { name: "Approve Pending User" }),
    ).toBeInTheDocument();
  });

  it("approves a pending member with one click from the dashboard", async () => {
    const user = userEvent.setup();
    const { fetchPendingMembers, approveMember } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [pendingMember],
      total: 1,
    });
    vi.mocked(approveMember).mockResolvedValue({
      ...pendingMember,
      status: "approved",
    });

    renderBoardDashboard();
    await screen.findByText("Pending User");

    await user.click(
      screen.getByRole("button", { name: "Approve Pending User" }),
    );

    await waitFor(() => {
      expect(approveMember).toHaveBeenCalledWith(2);
    });
    expect(screen.queryByText("Pending User")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("pending-approval-count")).toHaveTextContent(
        "0",
      );
    });
  });

  it("does not show reject buttons on the dashboard queue", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [pendingMember],
      total: 1,
    });

    renderBoardDashboard();
    await screen.findByText("Pending User");

    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
  });
});
