import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import * as discussionApi from "../../lib/discussion-api";
import * as membersApi from "../../lib/members-api";
import { MockAuthProvider } from "../../test/test-utils";
import { DiscussionRoomMembersDrawer } from "./DiscussionRoomMembersDrawer";

vi.mock("../../lib/discussion-api", async () => {
  const actual = await vi.importActual<typeof discussionApi>(
    "../../lib/discussion-api",
  );
  return {
    ...actual,
    fetchDiscussionRoom: vi.fn(),
    ensureDirectMessage: vi.fn(),
    addDiscussionRoomMembers: vi.fn(),
    removeDiscussionRoomMember: vi.fn(),
    fetchDiscussionPresence: vi.fn().mockResolvedValue({ "3": true }),
  };
});

vi.mock("../../lib/members-api", () => ({
  fetchAssignableMembers: vi.fn(),
}));

const viewer: MemberResponse = {
  id: 1,
  full_name: "Board Viewer",
  email: "board@semo.edu",
  student_id: "11111111",
  major: "CS",
  graduation_year: 2027,
  role: "board",
  status: "approved",
  position: "member",
};

const directory: MemberResponse[] = [
  viewer,
  {
    id: 3,
    full_name: "Alex Member",
    email: "alex@semo.edu",
    student_id: "33333333",
    major: "CS",
    graduation_year: 2028,
    role: "general",
    status: "approved",
    position: "member",
  },
];

describe("DiscussionRoomMembersDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists group members in sections with search", async () => {
    vi.mocked(discussionApi.fetchDiscussionRoom).mockResolvedValue({
      id: 9,
      name: "Decor Crew",
      description: null,
      kind: "group",
      status: "live",
      room_id: "room:9",
      href: "/discussions/room/9",
      created_by_id: 1,
      created_by_name: "Board Viewer",
      reviewed_by_id: 1,
      reviewed_by_name: "Board Viewer",
      review_note: null,
      created_at: "2026-07-01T00:00:00Z",
      reviewed_at: "2026-07-01T00:00:00Z",
      members: [
        { member_id: 1, full_name: "Board Viewer", role: "owner" },
        { member_id: 3, full_name: "Alex Member", role: "member" },
      ],
    });
    vi.mocked(membersApi.fetchAssignableMembers).mockResolvedValue({
      members: directory,
      total: directory.length,
    });

    render(
      <MockAuthProvider value={{ member: viewer, isAuthenticated: true }}>
        <MemoryRouter>
          <DiscussionRoomMembersDrawer
            open
            roomId={9}
            onClose={() => undefined}
          />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alex Member")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search members")).toBeInTheDocument();
    expect(screen.getByText(/ADMIN/)).toBeInTheDocument();
    expect(screen.getByText(/MEMBER/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Message Alex Member" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Invite members/i }),
    ).toBeInTheDocument();
  });

  it("opens a DM when a peer row is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(discussionApi.fetchDiscussionRoom).mockResolvedValue({
      id: 9,
      name: "Decor Crew",
      description: null,
      kind: "group",
      status: "live",
      room_id: "room:9",
      href: "/discussions/room/9",
      created_by_id: 1,
      created_by_name: "Board Viewer",
      reviewed_by_id: null,
      reviewed_by_name: null,
      review_note: null,
      created_at: "2026-07-01T00:00:00Z",
      reviewed_at: null,
      members: [
        { member_id: 1, full_name: "Board Viewer", role: "owner" },
        { member_id: 3, full_name: "Alex Member", role: "member" },
      ],
    });
    vi.mocked(membersApi.fetchAssignableMembers).mockResolvedValue({
      members: directory,
      total: directory.length,
    });
    vi.mocked(discussionApi.ensureDirectMessage).mockResolvedValue({
      id: 44,
      name: "DM · Alex Member",
      description: null,
      kind: "dm",
      status: "live",
      room_id: "room:44",
      href: "/discussions/room/44",
      created_by_id: 1,
      created_by_name: "Board Viewer",
      reviewed_by_id: 1,
      reviewed_by_name: "Board Viewer",
      review_note: null,
      created_at: "2026-07-01T00:00:00Z",
      reviewed_at: "2026-07-01T00:00:00Z",
      members: [],
      peer_member_id: 3,
      peer_full_name: "Alex Member",
    });

    const onClose = vi.fn();
    render(
      <MockAuthProvider value={{ member: viewer, isAuthenticated: true }}>
        <MemoryRouter>
          <DiscussionRoomMembersDrawer open roomId={9} onClose={onClose} />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Message Alex Member" }),
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: "Message Alex Member" }),
    );
    await waitFor(() => {
      expect(discussionApi.ensureDirectMessage).toHaveBeenCalledWith(3);
    });
    expect(onClose).toHaveBeenCalled();
  });
});
