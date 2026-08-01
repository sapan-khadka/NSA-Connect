import { describe, expect, it } from "vitest";

import type { DiscussionInboxRoom } from "./discussion-api";
import {
  buildDiscussionAttentionItems,
  isLowValuePreview,
  roomMentionsYou,
} from "./home-discussion-attention";

function room(
  overrides: Partial<DiscussionInboxRoom> & Pick<DiscussionInboxRoom, "room_id">,
): DiscussionInboxRoom {
  return {
    label: overrides.room_id,
    event_id: null,
    href: "/",
    last_message_preview: "Useful update about the venue",
    last_message_at: "2030-01-01T12:00:00Z",
    last_message_author: "Ada",
    unread_count: 0,
    unread_display: null,
    mentions_you: false,
    attention_preview: null,
    attention_author: null,
    pinned: false,
    pinned_at: null,
    muted: false,
    ...overrides,
  };
}

const NOW = new Date("2030-01-01T18:00:00Z");

describe("isLowValuePreview", () => {
  it("flags acks and emoji-only chatter", () => {
    expect(isLowValuePreview("ok")).toBe(true);
    expect(isLowValuePreview("👍")).toBe(true);
    expect(isLowValuePreview("Can you book the venue?")).toBe(false);
  });
});

describe("roomMentionsYou", () => {
  it("uses the API flag when set", () => {
    expect(
      roomMentionsYou(room({ room_id: "a", mentions_you: true, unread_count: 1 })),
    ).toBe(true);
  });
});

describe("buildDiscussionAttentionItems", () => {
  it("ranks mentions above unread above active", () => {
    const items = buildDiscussionAttentionItems(
      [
        room({
          room_id: "active",
          last_message_at: "2030-01-01T16:00:00Z",
        }),
        room({
          room_id: "unread",
          unread_count: 3,
          unread_display: "3",
          last_message_at: "2030-01-01T10:00:00Z",
        }),
        room({
          room_id: "mention",
          unread_count: 1,
          unread_display: "1",
          mentions_you: true,
          attention_author: "Walkthrough Officer",
          attention_preview: "Can you review the budget?",
          last_message_at: "2030-01-01T09:00:00Z",
        }),
      ],
      { now: NOW, cap: 5 },
    );

    expect(items.map((item) => item.room.room_id)).toEqual([
      "mention",
      "unread",
      "active",
    ]);
    expect(items[0]?.detail).toBe(
      "Walkthrough Officer: Can you review the budget?",
    );
    expect(items[0]?.badge).toBe("1");
    expect(items[1]?.badge).toBe("3");
    expect(items[2]?.badge).toBeNull();
  });

  it("fills remaining slots with recent rooms", () => {
    const items = buildDiscussionAttentionItems(
      [
        room({
          room_id: "unread",
          unread_count: 2,
          unread_display: "2",
          last_message_at: "2030-01-01T17:00:00Z",
        }),
        room({
          room_id: "recent-a",
          last_message_at: "2029-12-20T00:00:00Z",
          last_message_preview: "Budget approved",
        }),
        room({
          room_id: "recent-b",
          last_message_at: "2029-12-18T00:00:00Z",
          last_message_preview: "Invoice uploaded",
        }),
      ],
      { now: NOW, cap: 3 },
    );

    expect(items.map((item) => item.room.room_id)).toEqual([
      "unread",
      "recent-a",
      "recent-b",
    ]);
    expect(items[1]?.kind).toBe("recent");
    expect(items[1]?.detail).toBe("Ada: Budget approved");
  });

  it("skips muted rooms unless mentioned", () => {
    const items = buildDiscussionAttentionItems(
      [
        room({
          room_id: "muted-unread",
          unread_count: 4,
          muted: true,
        }),
        room({
          room_id: "muted-mention",
          unread_count: 1,
          mentions_you: true,
          muted: true,
        }),
      ],
      { now: NOW },
    );

    expect(items.map((item) => item.room.room_id)).toEqual(["muted-mention"]);
  });

  it("respects the cap after ranking and filler", () => {
    const items = buildDiscussionAttentionItems(
      [
        room({ room_id: "u1", unread_count: 1 }),
        room({ room_id: "u2", unread_count: 2 }),
        room({ room_id: "u3", unread_count: 3 }),
        room({ room_id: "r1", last_message_at: "2029-01-01T00:00:00Z" }),
      ],
      { now: NOW, cap: 2 },
    );
    expect(items).toHaveLength(2);
    expect(items[0]?.room.room_id).toBe("u3");
  });
});
