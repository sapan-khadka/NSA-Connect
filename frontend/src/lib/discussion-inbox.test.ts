import { describe, expect, it } from "vitest";

import type { DiscussionInboxRoom } from "./discussion-api";
import { sortDiscussionInboxRooms } from "./discussion-inbox";

function room(
  overrides: Partial<DiscussionInboxRoom> & Pick<DiscussionInboxRoom, "room_id">,
): DiscussionInboxRoom {
  return {
    label: overrides.room_id,
    event_id: null,
    href: "/discussions",
    last_message_preview: null,
    last_message_at: null,
    last_message_author: null,
    unread_count: 0,
    unread_display: null,
    pinned: false,
    pinned_at: null,
    ...overrides,
  };
}

describe("sortDiscussionInboxRooms", () => {
  it("keeps board pinned first, then other pins, then recency", () => {
    const sorted = sortDiscussionInboxRooms([
      room({
        room_id: "room:2",
        last_message_at: "2026-08-19T12:00:00Z",
      }),
      room({
        room_id: "room:1",
        pinned: true,
        pinned_at: "2026-08-18T10:00:00Z",
      }),
      room({
        room_id: "board",
        pinned: true,
        pinned_at: "2026-08-01T00:00:00Z",
      }),
      room({
        room_id: "event:9",
        last_message_at: "2026-08-19T18:00:00Z",
      }),
    ]);

    expect(sorted.map((item) => item.room_id)).toEqual([
      "board",
      "room:1",
      "event:9",
      "room:2",
    ]);
  });
});
