import { describe, expect, it } from "vitest";

import { buildDiscussionTimeline } from "../components/DiscussionFeed";
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
    const messages = items.filter((item) => item.kind === "message");
    expect(messages[0]).toMatchObject({
      kind: "message",
      showMeta: true,
      isOwn: true,
    });
    expect(messages[1]).toMatchObject({
      kind: "message",
      showMeta: false,
      isOwn: true,
    });
    expect(messages[2]).toMatchObject({
      kind: "message",
      showMeta: true,
      isOwn: false,
    });
  });
});
