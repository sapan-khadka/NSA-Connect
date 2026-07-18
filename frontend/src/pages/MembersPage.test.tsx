import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import {
  downloadMembersCsv,
  importMembersCsv,
} from "../lib/members-api";
import { MockAuthProvider } from "../test/test-utils";

import { MembersPage } from "./MembersPage";

vi.mock("../lib/members-api", () => ({
  fetchMembers: vi.fn(),
  fetchPendingMembers: vi.fn(),
  downloadMembersCsv: vi.fn(),
  importMembersCsv: vi.fn(),
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

async function mockDirectoryApis(options?: {
  members?: MemberResponse[];
  total?: number;
  approvedTotal?: number;
  pendingTotal?: number;
  unpaidCount?: number;
  partialCount?: number;
  duesRecords?: Array<{
    member_id: number;
    amount_owed: string;
    amount_paid: string;
    status: "paid" | "unpaid" | "partial" | "exempt";
  }>;
}) {
  const { fetchMembers, fetchPendingMembers } = await import(
    "../lib/members-api"
  );
  const { fetchDuesDashboard } = await import("../lib/dues-api");

  const members = options?.members ?? [];
  const total = options?.total ?? members.length;

  vi.mocked(fetchMembers).mockImplementation(async (params = {}) => {
    if (params.status === "approved") {
      return {
        members: [],
        total: options?.approvedTotal ?? members.filter((m) => m.status === "approved").length,
        page: 1,
        page_size: 1,
        total_pages: 1,
      };
    }
    return {
      members,
      total,
      page: 1,
      page_size: 100,
      total_pages: 1,
    };
  });

  vi.mocked(fetchPendingMembers).mockResolvedValue({
    members: [],
    total: options?.pendingTotal ?? 0,
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

function renderMembersPage(role: "board" | "president" | "treasurer" = "president") {
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

  it("renders the header with subtitle and actions", async () => {
    await mockDirectoryApis();
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
    expect(screen.getByRole("button", { name: "Import CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("imports a CSV file and shows a summary modal", async () => {
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

  it("shows a loading state while importing members", async () => {
    await mockDirectoryApis();
    let finishImport: (() => void) | undefined;
    vi.mocked(importMembersCsv).mockReturnValue(
      new Promise((resolve) => {
        finishImport = () =>
          resolve({
            rows_created: 1,
            rows_skipped: 0,
            skipped_rows: [],
          });
      }),
    );
    renderMembersPage();

    const importButton = screen.getByRole("button", { name: "Import CSV" });
    const fileInput = document.querySelector(
      'input[type="file"][accept=".csv,text/csv"]',
    ) as HTMLInputElement;
    const file = new File(["csv"], "members.csv", { type: "text/csv" });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(importButton).toBeDisabled();
      expect(importButton).toHaveAttribute("aria-busy", "true");
    });

    finishImport?.();
    await waitFor(() => {
      expect(importButton).toBeEnabled();
      expect(importButton).not.toHaveAttribute("aria-busy");
    });
  });

  it("shows a loading state while exporting members", async () => {
    await mockDirectoryApis();
    let finishDownload: (() => void) | undefined;
    vi.mocked(downloadMembersCsv).mockReturnValue(
      new Promise<void>((resolve) => {
        finishDownload = resolve;
      }),
    );
    renderMembersPage();

    const exportButton = screen.getByRole("button", { name: "Export" });
    await userEvent.click(exportButton);

    expect(downloadMembersCsv).toHaveBeenCalledOnce();
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("aria-busy", "true");

    finishDownload?.();
    await waitFor(() => {
      expect(exportButton).toBeEnabled();
      expect(exportButton).not.toHaveAttribute("aria-busy");
    });
  });

  it("renders KPI cards from live member and dues totals", async () => {
    await mockDirectoryApis({
      members: [directoryMember],
      total: 12,
      approvedTotal: 10,
      pendingTotal: 2,
      unpaidCount: 3,
      partialCount: 1,
    });
    renderMembersPage("president");

    const stats = screen.getByLabelText("Statistics");
    await waitFor(() => {
      expect(within(stats).getByLabelText("Members: 12")).toBeInTheDocument();
    });
    expect(within(stats).getByLabelText("Active: 10")).toBeInTheDocument();
    expect(within(stats).getByLabelText("Pending: 2")).toBeInTheDocument();
    expect(
      within(stats).getByLabelText("Outstanding Dues: 4"),
    ).toBeInTheDocument();
  });

  it("hides outstanding dues count when treasury access is unavailable", async () => {
    await mockDirectoryApis({
      members: [directoryMember],
      total: 5,
      approvedTotal: 5,
      pendingTotal: 0,
    });
    renderMembersPage("board");

    const stats = screen.getByLabelText("Statistics");
    await waitFor(() => {
      expect(within(stats).getByLabelText("Members: 5")).toBeInTheDocument();
    });
    expect(
      within(stats).getByLabelText("Outstanding Dues: —"),
    ).toBeInTheDocument();
    expect(
      within(stats).getByText("Treasury access required"),
    ).toBeInTheDocument();
  });

  it("renders the Linear-style search and filter toolbar", async () => {
    const user = userEvent.setup();
    await mockDirectoryApis();
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

    const tableRegion = await screen.findByRole("region", {
      name: "Member table",
    });
    const table = within(tableRegion).getByRole("table", {
      name: "Organization members",
    });

    expect(
      within(table).getByRole("button", { name: /Sort by Name/i }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: /Sort by Role/i }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: /Sort by Status/i }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: /Sort by Graduation Year/i }),
    ).toBeInTheDocument();
    expect(within(table).getByText("Outstanding Dues")).toBeInTheDocument();
    expect(within(table).getByText("Attendance")).toBeInTheDocument();
    expect(within(table).getByText("Actions")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Alex Member")).toBeInTheDocument();
    expect(within(tableRegion).getByText("Active")).toBeInTheDocument();
    expect(within(tableRegion).getByText("2028")).toBeInTheDocument();
    expect(within(tableRegion).getByText("$15.00")).toBeInTheDocument();
    expect(
      within(tableRegion).getByLabelText("View Alex Member"),
    ).toBeInTheDocument();
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
});
