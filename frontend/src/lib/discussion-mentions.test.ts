import { describe, expect, it } from "vitest";

import {
  applyMentionCompletion,
  detectMentionQuery,
  extractRichPreviewTokens,
  formatForwardedContent,
  messagePermalink,
} from "./discussion-mentions";
import { buildDiscussionThreads } from "./discussion-threads";
import type { DiscussionMessage } from "./discussion-api";

function msg(
  id: number,
  content: string,
  replyTo?: number,
): DiscussionMessage {
  return {
    id,
    content,
    event_id: null,
    created_at: "2030-01-01T10:00:00Z",
    author: { id: 1, full_name: "Ada" },
    reply_to_message_id: replyTo ?? null,
  };
}

describe("buildDiscussionThreads", () => {
  it("nests replies under roots", () => {
    const threads = buildDiscussionThreads([
      msg(1, "root"),
      msg(2, "reply", 1),
      msg(3, "nested", 2),
      msg(4, "other"),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads[0]?.root.id).toBe(1);
    expect(threads[0]?.replies.map((row) => row.id)).toEqual([2, 3]);
    expect(threads[1]?.root.id).toBe(4);
  });
});

describe("detectMentionQuery", () => {
  it("detects @ query at cursor", () => {
    expect(detectMentionQuery("hi @Ada", 7)).toEqual({
      kind: "member",
      query: "Ada",
      start: 3,
      end: 7,
    });
  });

  it("detects # and $ triggers", () => {
    expect(detectMentionQuery("#cult", 5)?.kind).toBe("event");
    expect(detectMentionQuery("$Bud", 4)?.kind).toBe("budget");
  });
});

describe("applyMentionCompletion", () => {
  it("replaces the active token", () => {
    const result = applyMentionCompletion("hi @Ad", {
      kind: "member",
      query: "Ad",
      start: 3,
      end: 6,
    }, "@Ada Lovelace ");
    expect(result.next).toBe("hi @Ada Lovelace ");
  });
});

describe("extractRichPreviewTokens", () => {
  it("finds member event and budget tokens", () => {
    const tokens = extractRichPreviewTokens(
      "Ping @Mukesh about #Cultural Night and $Budget",
    );
    expect(tokens.map((token) => token.kind).sort()).toEqual([
      "budget",
      "event",
      "member",
    ]);
  });
});

describe("forward helpers", () => {
  it("formats forward text and permalink", () => {
    expect(formatForwardedContent(msg(9, "hello"))).toContain("hello");
    expect(messagePermalink("/discussions/board", 9)).toContain("msg=9");
  });
});
