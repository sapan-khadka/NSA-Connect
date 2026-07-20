import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import {
  downloadMembersCsv,
  importMembersCsv,
  inviteMember,
} from "../lib/members-api";
import { MockAuthProvider } from "../test/test-utils";

import { MembersPage } from "./MembersPage";

vi.mock("../lib/members-api", () => ({
  fetchMembers: vi.fn(),
  fetchPendingMembers: vi.fn(),
  fetchMembersEngagement: vi.fn(),
  downloadMembersCsv: vi.fn(),
  importMembersCsv: vi.fn(),
  inviteMember: vi.fn(),
  approveMember: vi.fn(),
  rejectMember: vi.fn(),
  fetchMemberPositionCatalog: vi.fn().mockResolvedValue({
    built_in: [],
    custom: [],
  }),
  createCustomBoardPosition: vi.fn(),
  renameCustomBoardPosition: vi.fn(),
  archiveCustomBoardPosition: vi.fn(),
}));

vi.mock("../lib/dues-api", () => ({
  fetchDuesDashboard: vi.fn(),
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

const pendingMember: MemberResponse = {
  ...directoryMember,
  id: 9,
  full_name: "Pending Person",
  email: "pending@semo.edu",
  student_id: "S99999999",
  status: "pending",
  role: "general",
};

async function mockDirectoryApis(options?: {
  members?: MemberResponse[];
  total?: number;
  approvedTotal?: number;
  pendingTotal?: number;
  pendingMembers?: MemberResponse[];
  activeCount?: number;
  idleCount?: number;
  unpaidCount?: number;
  partialCount?: number;
  duesRecords?: Array<{
    member_id: number;
    amount_owed: string;
    amount_paid: string;
    status: "paid" | "unpaid" | "partial" | "exempt";
  }>;
}) {
  const { fetchMembers, fetchPendingMembers, fetchMembersEngagement } =
    await import("../lib/members-api");
  const { fetchDuesDashboard } = await import("../lib/dues-api");

  const members = options?.members ?? [];
  const total = options?.total ?? members.length;
  const pendingMembers = options?.pendingMembers ?? [];
  const approvedMembers = members.filter((m) => m.status === "approved");
  const activeCount =
    options?.activeCount ??
    options?.approvedTotal ??
    approvedMembers.length;
  const idleCount = options?.idleCount ?? 0;

  vi.mocked(fetchMembers).mockResolvedValue({
    members,
    total,
    page: 1,
    page_size: 100,
    total_pages: 1,
  });

  vi.mocked(fetchPendingMembers).mockResolvedValue({
    members: pendingMembers,
    total: options?.pendingTotal ?? pendingMembers.length,
  });

  vi.mocked(fetchMembersEngagement).mockResolvedValue({
    semester: "2026-summer",
    window_days: 90,
    active_count: activeCount,
    idle_count: idleCount,
    members: approvedMembers.map((member, index) => ({
      member_id: member.id,
      status: index < activeCount ? "active" : "idle",
      signals: {
        attended_event: index < activeCount,
        paid_dues: false,
        completed_task: false,
        in_progress_task: false,
        shared_suggestion: false,
      },
    })),
  });

  vi.mocked(fetchDuesDashboard).mockResolvedValue({
    summary: {
      semester: "2026-summer",
      default_amount: "20.00",
      total_expected: "0",
      total_collected: "0",
      total_outstanding: "40.00",
      paid_count: 0,
      unpaid_count: options?.unpaidCount ?? 0,
      partial_count: options?.partialCount ?? 0,
      exempt_count: 0,
      member_count: total,
    },
    records: (options?.duesRecords ?? []).map((record, index) => ({
      id: index + 1,
      member_id: record.member_id,
      member_name: "Member",
      member_email: "m@semo.edu",
      semester: "2026-summer",
      amount_owed: record.amount_owed,
      amount_paid: record.amount_paid,
      status: record.status,
      paid_at: null,
      payment_method: null,
      note: null,
      finance_entry_id: null,
    })),
  });
}

function renderMembersPage(
  role: "board" | "president" | "treasurer" = "president",
  initialEntry = "/members",
) {
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
          role,
          status: "approved",
          position: role === "president" ? "president" : "member",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <MembersPage />
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

async function openManageMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Manage/i }));
}

async function submitValidInvite(
  user: ReturnType<typeof userEvent.setup>,
  setupEmailSent: boolean,
) {
  vi.mocked(inviteMember).mockResolvedValue({
    member: {
      ...directoryMember,
      id: 44,
      full_name: "New Member",
      email: "new@semo.edu",
      student_id: "S12345678",
      role: "general",
      status: "approved",
      position: "member",
    },
    setup_email_sent: setupEmailSent,
  });

  await user.click(screen.getByRole("button", { name: "Invite Member" }));
  const dialog = screen.getByRole("dialog", { name: "Invite Member" });
  await user.type(within(dialog).getByLabelText(/First name/i), "New");
  await user.type(within(dialog).getByLabelText(/Last name/i), "Member");
  await user.type(within(dialog).getByLabelText(/Student ID/i), "S12345678");
  await user.type(within(dialog).getByLabelText(/Major/i), "Computer Science");
  await user.selectOptions(
    within(dialog).getByLabelText(/Graduation year/i),
    String(new Date().getFullYear()),
  );
  await user.type(within(dialog).getByLabelText(/Email address/i), "new@semo.edu");
  await user.click(within(dialog).getByRole("button", { name: "Invite" }));
}

describe("MembersPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a quiet header with invite and manage menu", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    renderMembersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review signups, follow up on dues, and browse people."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invite Member" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import CSV" })).not.toBeInTheDocument();

    await openManageMenu(user);
    expect(screen.getByRole("menuitem", { name: "Import CSV" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export CSV" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Board positions" }),
    ).toBeInTheDocument();
  });

  it("hides board positions manage item for non-presidents", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    renderMembersPage("board");

    await openManageMenu(user);
    expect(
      screen.queryByRole("menuitem", { name: "Board positions" }),
    ).not.toBeInTheDocument();
  });

  it("imports a CSV file from the manage menu and shows a summary modal", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    vi.mocked(importMembersCsv).mockResolvedValue({
      rows_created: 2,
      rows_skipped: 1,
      skipped_rows: [
        {
          row_number: 3,
          email: "dup@semo.edu",
          reason: "Email already registered",
        },
      ],
    });
    renderMembersPage();

    await openManageMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Import CSV" }));

    const fileInput = document.querySelector(
      'input[type="file"][accept=".csv,text/csv"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(
      ["full_name,email,student_id,major,graduation_year\n"],
      "members.csv",
      { type: "text/csv" },
    );
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(importMembersCsv).toHaveBeenCalledOnce();
    });
    expect(importMembersCsv).toHaveBeenCalledWith(file);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Member import complete" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("2")).toBeInTheDocument();
    expect(within(dialog).getByText(/members created/i)).toBeInTheDocument();
    expect(within(dialog).getByText("1")).toBeInTheDocument();
    expect(within(dialog).getByText(/rows skipped/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Row 3 — dup@semo.edu/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Email already registered"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Forgot Password/i)).toBeInTheDocument();
  });

  it("exports members from the manage menu", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    vi.mocked(downloadMembersCsv).mockResolvedValue(undefined);
    renderMembersPage();

    await openManageMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Export CSV" }));

    await waitFor(() => {
      expect(downloadMembersCsv).toHaveBeenCalledOnce();
    });
  });

  it("renders a compact status strip with engagement-based active/idle", async () => {
    await mockDirectoryApis({
      members: [directoryMember],
      total: 12,
      activeCount: 7,
      idleCount: 3,
      pendingTotal: 2,
      unpaidCount: 3,
      partialCount: 1,
    });
    renderMembersPage("president");

    const summary = screen.getByLabelText("Members summary");
    await waitFor(() => {
      expect(summary).toHaveTextContent("12 members");
    });
    expect(summary).toHaveTextContent("7 active");
    expect(summary).toHaveTextContent("3 idle");
    expect(summary).toHaveTextContent("2 pending");
    expect(summary).toHaveTextContent("4 outstanding dues");
    expect(screen.queryByLabelText("Statistics")).not.toBeInTheDocument();
  });

  it("hides outstanding dues in the strip without treasury access", async () => {
    await mockDirectoryApis({
      members: [directoryMember],
      total: 5,
      approvedTotal: 5,
      pendingTotal: 0,
    });
    renderMembersPage("board");

    const summary = await screen.findByLabelText("Members summary");
    await waitFor(() => {
      expect(summary).toHaveTextContent("5 members");
    });
    expect(summary).toHaveTextContent("5 active");
    expect(summary).not.toHaveTextContent("outstanding dues");
  });

  it("renders People filters without hollow committee/attendance controls", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    renderMembersPage();

    expect(screen.getByLabelText("Search members")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.getByLabelText("Member Status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Committee")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Attendance")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset Filters" }),
    ).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Role"), "board");
    expect(
      screen.getByRole("button", { name: "Reset Filters" }),
    ).toBeEnabled();
  });

  it("auto-opens Needs attention when pending signups exist", async () => {
    await mockDirectoryApis({
      members: [directoryMember, pendingMember],
      total: 2,
      approvedTotal: 1,
      pendingTotal: 1,
      pendingMembers: [pendingMember],
    });

    renderMembersPage("board");

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: /Needs attention/i }),
      ).toHaveAttribute("aria-selected", "true");
    });
    expect(await screen.findByText("Pending Person")).toBeInTheDocument();
  });

  it("opens Needs attention from ?tab=pending with approval queue", async () => {
    await mockDirectoryApis({
      members: [directoryMember, pendingMember],
      total: 2,
      approvedTotal: 1,
      pendingTotal: 1,
      pendingMembers: [pendingMember],
    });

    renderMembersPage("board", "/members?tab=pending");

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: /Needs attention/i }),
      ).toHaveAttribute("aria-selected", "true");
    });

    expect(screen.getByText("Pending Person")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Approve Pending Person/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reject Pending Person/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Member table")).not.toBeInTheDocument();
  });

  it("switches to People directory from Needs attention", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis({
      members: [directoryMember],
      total: 1,
      approvedTotal: 1,
      pendingTotal: 1,
      pendingMembers: [pendingMember],
    });

    renderMembersPage("board", "/members?tab=pending");

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: /Needs attention/i }),
      ).toHaveAttribute("aria-selected", "true");
    });

    await user.click(screen.getByRole("tab", { name: "People" }));
    expect(await screen.findByLabelText("Member table")).toBeInTheDocument();
    expect(await screen.findByText("Alex Member")).toBeInTheDocument();
  });

  it("renders the members table without attendance or bulk checkboxes", async () => {
    await mockDirectoryApis({
      members: [directoryMember],
      total: 1,
      approvedTotal: 1,
      duesRecords: [
        {
          member_id: 3,
          amount_owed: "20.00",
          amount_paid: "5.00",
          status: "partial",
        },
      ],
    });

    renderMembersPage("treasurer");

    const tableRegion = await screen.findByLabelText("Member table");
    const table = within(tableRegion).getByRole("table", {
      name: "Organization members",
    });

    expect(
      within(table).getByRole("button", { name: /Sort by Name/i }),
    ).toBeInTheDocument();
    expect(within(table).getByText("Outstanding Dues")).toBeInTheDocument();
    expect(within(table).queryByText("Attendance")).not.toBeInTheDocument();
    expect(
      within(table).queryByLabelText("Select all members"),
    ).not.toBeInTheDocument();
    expect(within(tableRegion).getByText("Alex Member")).toBeInTheDocument();
    expect(within(tableRegion).getByText("$15.00")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Active")).toBeInTheDocument();
  });

  it("shows Idle status for approved members without engagement", async () => {
    await mockDirectoryApis({
      members: [directoryMember],
      total: 1,
      activeCount: 0,
      idleCount: 1,
    });

    renderMembersPage("board");

    await userEvent.click(screen.getByRole("tab", { name: "People" }));
    const tableRegion = await screen.findByLabelText("Member table");
    expect(within(tableRegion).getByText("Idle")).toBeInTheDocument();
  });

  it("opens Member Quick View when a table row is clicked", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis({
      members: [directoryMember],
      total: 1,
      approvedTotal: 1,
    });

    renderMembersPage();

    const row = await screen.findByRole("row", {
      name: /Quick view Alex Member/i,
    });
    await user.click(row);

    const dialog = await screen.findByRole("dialog", {
      name: /Alex Member/i,
    });
    expect(
      within(dialog).getByRole("heading", { name: /Alex Member/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "View Full Profile" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("No recent activity yet.")).toBeInTheDocument();
  });

  it("opens the Invite Member drawer from the header", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();

    renderMembersPage();

    await user.click(screen.getByRole("button", { name: "Invite Member" }));

    expect(
      screen.getByRole("dialog", { name: "Invite Member" }),
    ).toBeInTheDocument();
  });

  it("shows success when the setup email was accepted", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    renderMembersPage();

    await submitValidInvite(user, true);

    expect(
      await screen.findByText("Member created and setup email sent."),
    ).toBeInTheDocument();
  });

  it("warns when the member was created but setup email failed", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
    renderMembersPage();

    await submitValidInvite(user, false);

    expect(
      await screen.findByText(
        "Member created, but we couldn't send the setup email — ask them to use Forgot Password.",
      ),
    ).toBeInTheDocument();
  });
});
