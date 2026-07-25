import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import * as discussionApi from "../../lib/discussion-api";
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
  };
});

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

describe("DiscussionRoomMembersDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists group members and offers Message for peers", async () => {
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
    expect(screen.getByText("2 members")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Message Alex Member" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Message Board Viewer" }),
    ).not.toBeInTheDocument();
  });

  it("opens a DM when Message is clicked", async () => {
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
