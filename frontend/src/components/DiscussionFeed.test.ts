import { describe, expect, it } from "vitest";

import { buildDiscussionTimeline } from "../lib/discussion-timeline";
import type { DiscussionMessage } from "../lib/discussion-api";
import {
  discussionRoomIdFromPath,
  discussionRoomPath,
  discussionScopeFromPath,
} from "../lib/discussion-paths";

function msg(
  overrides: Partial<DiscussionMessage> &
    Pick<DiscussionMessage, "id" | "content" | "created_at"> & {
      authorId?: number;
      authorName?: string;
    },
): DiscussionMessage {
  return {
    id: overrides.id,
    content: overrides.content,
    event_id: overrides.event_id ?? null,
    created_at: overrides.created_at,
    author: {
      id: overrides.authorId ?? 1,
      full_name: overrides.authorName ?? "Ada",
    },
    reactions: overrides.reactions,
  };
}

describe("discussion paths", () => {
  it("builds room paths", () => {
    expect(discussionRoomPath("board")).toBe("/discussions/board");
    expect(discussionRoomPath("event:4")).toBe("/discussions/event/4");
  });

  it("parses scopes from path", () => {
    expect(discussionScopeFromPath("/discussions/board")).toEqual({
      type: "board",
    });
    expect(discussionScopeFromPath("/discussions/event/4")).toEqual({
      type: "event",
      eventId: 4,
    });
    expect(discussionRoomIdFromPath("/discussions/event/4")).toBe("event:4");
    expect(discussionScopeFromPath("/discussions")).toBeNull();
  });
});

describe("buildDiscussionTimeline", () => {
  it("inserts day separators and groups consecutive messages", () => {
    const items = buildDiscussionTimeline(
      [
        msg({
          id: 1,
          content: "hi",
          created_at: "2030-01-01T10:00:00Z",
          authorId: 1,
        }),
        msg({
          id: 2,
          content: "again",
          created_at: "2030-01-01T10:01:00Z",
          authorId: 1,
        }),
        msg({
          id: 3,
          content: "other",
          created_at: "2030-01-02T10:00:00Z",
          authorId: 2,
          authorName: "Bob",
        }),
      ],
      1,
    );

    expect(items.filter((item) => item.kind === "day")).toHaveLength(2);
    const groups = items.filter((item) => item.kind === "group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      kind: "group",
      isOwn: true,
    });
    expect(groups[0]?.messages).toHaveLength(2);
    expect(groups[1]).toMatchObject({
      kind: "group",
      isOwn: false,
    });
    expect(groups[1]?.messages).toHaveLength(1);
  });

  it("splits same-author groups after a long pause", () => {
    const items = buildDiscussionTimeline(
      [
        msg({
          id: 1,
          content: "earlier",
          created_at: "2030-01-01T10:00:00Z",
          authorId: 1,
        }),
        msg({
          id: 2,
          content: "much later",
          created_at: "2030-01-01T11:00:00Z",
          authorId: 1,
        }),
      ],
      1,
    );
    const groups = items.filter((item) => item.kind === "group");
    expect(groups).toHaveLength(2);
  });

  it("inserts an unread separator before the first unread message", () => {
    const items = buildDiscussionTimeline(
      [
        msg({
          id: 1,
          content: "read",
          created_at: "2030-01-01T10:00:00Z",
          authorId: 1,
        }),
        msg({
          id: 2,
          content: "unread",
          created_at: "2030-01-01T10:01:00Z",
          authorId: 2,
          authorName: "Bob",
        }),
      ],
      1,
      { firstUnreadMessageId: 2 },
    );
    const unreadIndex = items.findIndex((item) => item.kind === "unread");
    expect(unreadIndex).toBeGreaterThan(-1);
    expect(items[unreadIndex + 1]).toMatchObject({
      kind: "group",
      messages: [{ id: 2 }],
    });
  });
});
