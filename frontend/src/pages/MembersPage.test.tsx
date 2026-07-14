import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";

import { MembersPage } from "./MembersPage";

vi.mock("../lib/members-api", () => ({
  fetchMembers: vi.fn(),
}));

const directoryMember: MemberResponse = {
  id: 3,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S87654321",
  major: "Computer Science",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "member",
};

function renderMembersPage() {
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
          position: "member",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={["/members"]}>
        <MembersPage />
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("MembersPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  async function mockEmptyMembers() {
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });
  }

  it("renders the header with subtitle and actions", async () => {
    await mockEmptyMembers();
    renderMembersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage everyone in your organization."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invite Member" }),
    ).toBeInTheDocument();
  });

  it("renders four equal KPI cards in Statistics", async () => {
    await mockEmptyMembers();
    renderMembersPage();

    const stats = screen.getByLabelText("Statistics");
    expect(within(stats).getByLabelText("Members: 128")).toBeInTheDocument();
    expect(within(stats).getByLabelText("Active: 116")).toBeInTheDocument();
    expect(within(stats).getByLabelText("Pending: 6")).toBeInTheDocument();
    expect(
      within(stats).getByLabelText("Outstanding Dues: 18"),
    ).toBeInTheDocument();
  });

  it("renders the Linear-style search and filter toolbar", async () => {
    const user = userEvent.setup();
    await mockEmptyMembers();
    renderMembersPage();

    expect(screen.getByLabelText("Search members")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.getByLabelText("Member Status")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset Filters" }),
    ).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Role"), "board");
    expect(
      screen.getByRole("button", { name: "Reset Filters" }),
    ).toBeEnabled();
  });

  it("renders the members table with redesigned columns", async () => {
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [directoryMember],
      total: 1,
      page: 1,
      page_size: 48,
      total_pages: 1,
    });

    renderMembersPage();

    const tableRegion = await screen.findByRole("region", {
      name: "Member table",
    });
    const table = within(tableRegion).getByRole("table", {
      name: "Organization members",
    });

    expect(
      within(table).getByRole("button", { name: /Sort by Name/i }),
    ).toBeInTheDocument();
    expect(within(table).getByText("Committee")).toBeInTheDocument();
    expect(within(table).getByText("Attendance")).toBeInTheDocument();
    expect(within(table).getByText("Member Health")).toBeInTheDocument();
    expect(within(table).getByText("Outstanding Dues")).toBeInTheDocument();
    expect(within(table).getByText("Last Activity")).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: /Sort by Status/i }),
    ).toBeInTheDocument();
    expect(within(table).getByText("Actions")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Alex Member")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Approved")).toBeInTheDocument();
  });

  it("opens Member Quick View when a table row is clicked", async () => {
    const user = userEvent.setup();
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [directoryMember],
      total: 1,
      page: 1,
      page_size: 48,
      total_pages: 1,
    });

    renderMembersPage();

    const row = await screen.findByRole("row", {
      name: /Quick view Alex Member/i,
    });
    await user.click(row);

    const dialog = await screen.findByRole("dialog", {
      name: "Alex Member",
    });
    expect(
      within(dialog).getByRole("heading", { name: "Alex Member" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Health Score")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "View Profile" }),
    ).toBeInTheDocument();
  });

  it("opens the Invite Member drawer from the header", async () => {
    const user = userEvent.setup();
    await mockEmptyMembers();

    renderMembersPage();

    await user.click(screen.getByRole("button", { name: "Invite Member" }));

    expect(
      screen.getByRole("dialog", { name: "Invite Member" }),
    ).toBeInTheDocument();
  });
});
