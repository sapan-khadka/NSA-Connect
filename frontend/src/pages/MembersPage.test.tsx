import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";

import { MembersPage } from "./MembersPage";

vi.mock("../lib/members-api", () => ({
  fetchMembers: vi.fn(),
  fetchPendingMembers: vi.fn(),
  approveMember: vi.fn(),
  rejectMember: vi.fn(),
  updateMemberRole: vi.fn(),
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
};

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

function mockDirectoryResponse(members: MemberResponse[] = [directoryMember]) {
  return {
    members,
    total: members.length,
    page: 1,
    page_size: 10,
    total_pages: 1,
  };
}

function renderMembersPage(
  initialEntry = "/members?tab=pending",
  authMember: Partial<MemberResponse> & { role: MemberResponse["role"] } = {
    id: 1,
    full_name: "Board User",
    email: "board@semo.edu",
    student_id: "87654321",
    major: "Administration",
    graduation_year: 2028,
    role: "board",
    status: "approved",
  },
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
          role: "board",
          status: "approved",
          ...authMember,
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

describe("MembersPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the pending approval queue by default", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [pendingMember],
      total: 1,
    });

    renderMembersPage();

    expect(await screen.findByText("Pending User")).toBeInTheDocument();
    expect(screen.getByText("pending@semo.edu")).toBeInTheDocument();
  });

  it("shows the member directory when the directory tab is selected", async () => {
    const user = userEvent.setup();
    const { fetchMembers, fetchPendingMembers } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({ members: [], total: 0 });
    vi.mocked(fetchMembers).mockResolvedValue(mockDirectoryResponse());

    renderMembersPage();
    await user.click(screen.getByRole("button", { name: "Directory" }));

    expect(await screen.findByText("Alex Member")).toBeInTheDocument();
    expect(screen.getByText("alex@semo.edu")).toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("filters the directory with search", async () => {
    const user = userEvent.setup({ delay: null });
    const { fetchMembers, fetchPendingMembers } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({ members: [], total: 0 });
    vi.mocked(fetchMembers).mockResolvedValue(
      mockDirectoryResponse([
        directoryMember,
        {
          ...directoryMember,
          id: 4,
          full_name: "Jordan Smith",
          email: "jordan@semo.edu",
        },
      ]),
    );

    renderMembersPage();
    await user.click(screen.getByRole("button", { name: "Directory" }));
    await screen.findByText("Alex Member");

    await user.type(
      screen.getByPlaceholderText(/search by name, email, id, major, role/i),
      "jordan",
    );
    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.queryByText("Alex Member")).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
  });

  it("paginates the member directory", async () => {
    const user = userEvent.setup();
    const { fetchMembers, fetchPendingMembers } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({ members: [], total: 0 });
    vi.mocked(fetchMembers)
      .mockResolvedValueOnce({
        members: [directoryMember],
        total: 12,
        page: 1,
        page_size: 10,
        total_pages: 2,
      })
      .mockResolvedValueOnce({
        members: [
          {
            ...directoryMember,
            id: 5,
            full_name: "Page Two Member",
            email: "page2@semo.edu",
          },
        ],
        total: 12,
        page: 2,
        page_size: 10,
        total_pages: 2,
      });

    renderMembersPage();
    await user.click(screen.getByRole("button", { name: "Directory" }));
    await screen.findByText("Alex Member");

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page Two Member")).toBeInTheDocument();
    expect(fetchMembers).toHaveBeenLastCalledWith({
      page: 2,
      page_size: 10,
    });
  });

  it("does not show role promotion controls for board members", async () => {
    const user = userEvent.setup();
    const { fetchMembers, fetchPendingMembers } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({ members: [], total: 0 });
    vi.mocked(fetchMembers).mockResolvedValue(mockDirectoryResponse());

    renderMembersPage("/members?tab=pending", { role: "board", id: 1 });
    await user.click(screen.getByRole("button", { name: "Directory" }));
    await screen.findByText("Alex Member");

    expect(
      screen.queryByLabelText("Change role for Alex Member"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
  });

  it("lets presidents promote a general member to board", async () => {
    const user = userEvent.setup();
    const { fetchMembers, fetchPendingMembers, updateMemberRole } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({ members: [], total: 0 });
    vi.mocked(fetchMembers).mockResolvedValue(
      mockDirectoryResponse([
        {
          ...directoryMember,
          id: 4,
          role: "general",
          full_name: "Promote Me",
          email: "promote@semo.edu",
        },
      ]),
    );
    vi.mocked(updateMemberRole).mockResolvedValue({
      ...directoryMember,
      id: 4,
      role: "board",
      full_name: "Promote Me",
      email: "promote@semo.edu",
    });

    renderMembersPage("/members?tab=pending", {
      id: 1,
      role: "president",
      full_name: "President User",
      email: "president@semo.edu",
    });
    await user.click(screen.getByRole("button", { name: "Directory" }));
    await screen.findByText("Promote Me");

    await user.selectOptions(
      screen.getByLabelText("Change role for Promote Me"),
      "board",
    );

    await waitFor(() => {
      expect(updateMemberRole).toHaveBeenCalledWith(4, { role: "board" });
    });
  });

  it("does not let presidents change their own role", async () => {
    const user = userEvent.setup();
    const { fetchMembers, fetchPendingMembers } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({ members: [], total: 0 });
    vi.mocked(fetchMembers).mockResolvedValue(
      mockDirectoryResponse([
        {
          ...directoryMember,
          id: 1,
          role: "president",
          full_name: "President User",
          email: "president@semo.edu",
        },
      ]),
    );

    renderMembersPage("/members?tab=pending", {
      id: 1,
      role: "president",
      full_name: "President User",
      email: "president@semo.edu",
    });
    await user.click(screen.getByRole("button", { name: "Directory" }));
    await screen.findByText("President User");

    expect(
      screen.queryByLabelText("Change role for President User"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("President")).toBeInTheDocument();
  });

  it("lists pending members from the approval queue", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [pendingMember],
      total: 1,
    });

    renderMembersPage();

    expect(await screen.findByText("Pending User")).toBeInTheDocument();
    expect(screen.getByText("pending@semo.edu")).toBeInTheDocument();
  });

  it("shows an empty state when no members are pending", async () => {
    const { fetchPendingMembers } = await import("../lib/members-api");
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [],
      total: 0,
    });

    renderMembersPage();

    expect(
      await screen.findByText("No pending signups right now."),
    ).toBeInTheDocument();
  });

  it("approves a pending member and removes them from the queue", async () => {
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

    renderMembersPage();
    await screen.findByText("Pending User");

    const row = screen.getByText("Pending User").closest("li");
    expect(row).not.toBeNull();

    await user.click(
      within(row!).getByRole("button", { name: "Approve Pending User" }),
    );

    await waitFor(() => {
      expect(approveMember).toHaveBeenCalledWith(2);
    });
    expect(screen.queryByText("Pending User")).not.toBeInTheDocument();
  });

  it("rejects a pending member and removes them from the queue", async () => {
    const user = userEvent.setup();
    const { fetchPendingMembers, rejectMember } = await import(
      "../lib/members-api"
    );
    vi.mocked(fetchPendingMembers).mockResolvedValue({
      members: [pendingMember],
      total: 1,
    });
    vi.mocked(rejectMember).mockResolvedValue({
      ...pendingMember,
      status: "rejected",
    });

    renderMembersPage();
    await screen.findByText("Pending User");

    const row = screen.getByText("Pending User").closest("li");
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(rejectMember).toHaveBeenCalledWith(2);
    });
    expect(screen.queryByText("Pending User")).not.toBeInTheDocument();
  });
});
