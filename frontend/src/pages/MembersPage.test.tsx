import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders the Members header with actions", async () => {
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });

    renderMembersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage your organization members."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invite Member" }),
    ).toBeInTheDocument();
  });

  it("renders four equal KPI cards in Statistics", async () => {
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });

    renderMembersPage();

    expect(screen.getByText("Total Members")).toBeInTheDocument();
    expect(screen.getByText("Active Members")).toBeInTheDocument();
    expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Dues")).toBeInTheDocument();
  });

  it("renders the members filter toolbar controls", async () => {
    const user = userEvent.setup();
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });

    renderMembersPage();

    expect(screen.getByLabelText("Search members")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show filters" }));
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset Filters" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no members", async () => {
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });

    renderMembersPage();

    expect(await screen.findByText("No members yet")).toBeInTheDocument();
  });

  it("renders member rows with required columns and selection", async () => {
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

    const tableRegion = await screen.findByRole("region", {
      name: "Member Table",
    });
    expect(within(tableRegion).getByText("Alex Member")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Board")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Approved")).toBeInTheDocument();

    const table = within(tableRegion).getByRole("table", {
      name: "Organization members",
    });
    expect(within(table).getByText("Name")).toBeInTheDocument();
    expect(within(table).getByText("Role")).toBeInTheDocument();
    expect(within(table).getByText("Committee")).toBeInTheDocument();
    expect(within(table).getByText("Attendance")).toBeInTheDocument();
    expect(within(table).getByText("Dues")).toBeInTheDocument();
    expect(within(table).getByText("Last Activity")).toBeInTheDocument();
    expect(within(table).getByText("Status")).toBeInTheDocument();
    expect(within(table).getByText("Actions")).toBeInTheDocument();

    await user.click(
      within(tableRegion).getByRole("checkbox", {
        name: "Select Alex Member",
      }),
    );

    const bulkBar = await screen.findByRole("toolbar", {
      name: "Bulk member actions",
    });
    expect(within(bulkBar).getByText("1 member selected")).toBeInTheDocument();
    expect(
      within(bulkBar).getByRole("button", { name: /Email 1 selected member/i }),
    ).toBeInTheDocument();
    expect(
      within(bulkBar).getByRole("button", {
        name: /Assign Role 1 selected member/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(bulkBar).getByRole("button", {
        name: /Assign Committee 1 selected member/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(bulkBar).getByRole("button", {
        name: /Export 1 selected member/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(bulkBar).getByRole("button", {
        name: /Deactivate 1 selected member/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(bulkBar).getByRole("button", {
        name: /Delete 1 selected member/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      within(bulkBar).getByRole("button", { name: "Clear selection" }),
    );
    expect(
      screen.queryByRole("toolbar", { name: "Bulk member actions" }),
    ).not.toBeInTheDocument();
  });

  it("opens the Member Quick View drawer when a row is activated", async () => {
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

    await user.click(
      await screen.findByRole("row", { name: "Quick view Alex Member" }),
    );

    const drawer = screen.getByRole("dialog", { name: "Member Quick View" });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getAllByText("Alex Member").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("Board").length).toBeGreaterThan(0);
    expect(within(drawer).getByText("Recent Activity")).toBeInTheDocument();
    expect(within(drawer).getByText("Committee")).toBeInTheDocument();
    expect(within(drawer).getByText("Attendance")).toBeInTheDocument();
    expect(within(drawer).getByText("Payment Status")).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "View Profile" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Message" }),
    ).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("opens the Invite Member side drawer from the header", async () => {
    const user = userEvent.setup();
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });

    renderMembersPage();

    await user.click(screen.getByRole("button", { name: "Invite Member" }));

    const drawer = screen.getByRole("dialog", { name: "Invite Member" });
    expect(drawer).toBeInTheDocument();
    expect(
      within(drawer).getByRole("heading", { name: "Personal Information" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("heading", { name: "Role" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("heading", { name: "Committee" }),
    ).toBeInTheDocument();
    expect(within(drawer).getByLabelText("Email address")).toBeInTheDocument();
    expect(within(drawer).getByLabelText("Phone number")).toBeInTheDocument();
    expect(
      within(drawer).getByRole("heading", { name: "Expected Graduation" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Invite" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Save Draft" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });

  it("shows validation errors when inviting with an incomplete form", async () => {
    const user = userEvent.setup();
    const { fetchMembers } = await import("../lib/members-api");
    vi.mocked(fetchMembers).mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 48,
      total_pages: 0,
    });

    renderMembersPage();
    await user.click(screen.getByRole("button", { name: "Invite Member" }));

    const drawer = screen.getByRole("dialog", { name: "Invite Member" });
    await user.click(within(drawer).getByRole("button", { name: "Invite" }));

    expect(
      within(drawer).getByText(
        "Fix the highlighted fields before sending the invite.",
      ),
    ).toBeInTheDocument();
    expect(within(drawer).getByText("First name is required.")).toBeInTheDocument();
    expect(within(drawer).getByText("Email is required.")).toBeInTheDocument();
  });
});
