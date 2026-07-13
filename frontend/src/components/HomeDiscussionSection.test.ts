import { describe, expect, it } from "vitest";

import { selectHomeInboxRooms } from "../components/HomeDiscussionSection";
import type { DiscussionInboxRoom } from "../lib/discussion-api";

function room(
  overrides: Partial<DiscussionInboxRoom> & Pick<DiscussionInboxRoom, "room_id">,
): DiscussionInboxRoom {
  return {
    label: overrides.room_id,
    event_id: null,
    href: "/",
    last_message_preview: "hi",
    last_message_at: "2030-01-01T00:00:00Z",
    last_message_author: "Ada",
    unread_count: 0,
    unread_display: null,
    pinned: false,
    pinned_at: null,
    ...overrides,
  };
}

describe("selectHomeInboxRooms", () => {
  it("keeps all pinned rooms even above the cap", () => {
    const rooms = [
      room({ room_id: "p1", pinned: true, pinned_at: "2030-01-02T00:00:00Z" }),
      room({ room_id: "p2", pinned: true, pinned_at: "2030-01-01T00:00:00Z" }),
      room({ room_id: "p3", pinned: true, pinned_at: "2030-01-03T00:00:00Z" }),
      room({ room_id: "u1", pinned: false }),
    ];
    const visible = selectHomeInboxRooms(rooms, 2);
    expect(visible.map((row) => row.room_id)).toEqual(["p1", "p2", "p3"]);
  });

  it("fills remaining slots with unpinned rooms", () => {
    const rooms = [
      room({ room_id: "p1", pinned: true }),
      room({ room_id: "u1" }),
      room({ room_id: "u2" }),
      room({ room_id: "u3" }),
    ];
    const visible = selectHomeInboxRooms(rooms, 3);
    expect(visible.map((row) => row.room_id)).toEqual(["p1", "u1", "u2"]);
  });
});
