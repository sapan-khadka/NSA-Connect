import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  prependOlderMessages,
  resolveFirstUnreadMessageId,
  useDiscussion,
  useEventDiscussion,
} from "./useEventDiscussion";
import type { DiscussionMessage } from "./discussion-api";

const sockets: MockWebSocket[] = [];

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(
      new CloseEvent("close", { code, reason: "", wasClean: true }),
    );
  }
}

vi.mock("./auth-token", () => ({
  getAccessToken: () => "test-token",
}));

vi.mock("./discussion-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./discussion-api")>();
  return {
    ...actual,
    fetchDiscussionWsTicket: vi.fn().mockResolvedValue({
      token: "ws-ticket",
      expires_at: "2030-01-01T00:02:00Z",
    }),
  };
});

describe("useDiscussion", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads event history and appends broadcast messages", async () => {
    const { result } = renderHook(() => useEventDiscussion(12));

    await waitFor(() => expect(sockets).toHaveLength(1));
    expect(sockets[0].url).toContain("/ws/events/12/discussion");
    expect(sockets[0].url).toContain("token=ws-ticket");

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "history",
            messages: [
              {
                id: 1,
                content: "Hello",
                event_id: 12,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
              },
            ],
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.status).toBe("live");

    act(() => {
      result.current.sendMessage("Reply");
    });
    expect(sockets[0].sent).toEqual([JSON.stringify({ content: "Reply" })]);

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "message",
            message: {
              id: 2,
              content: "Reply",
              event_id: 12,
              created_at: "2030-01-01T00:01:00Z",
              author: { id: 2, full_name: "Board User" },
            },
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
  });

  it("tracks presence and typing events", async () => {
    const { result } = renderHook(() => useDiscussion({ type: "board" }));

    await waitFor(() => expect(sockets).toHaveLength(1));
    expect(sockets[0].url).toContain("/ws/board/discussion");

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "presence_snapshot",
            users: [
              { user_id: 1, full_name: "Ada Board", initials: "AB" },
            ],
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.presentUsers).toHaveLength(1));

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "presence",
            action: "joined",
            user: { user_id: 2, full_name: "Bea Board", initials: "BB" },
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.presentUsers).toHaveLength(2));

    act(() => {
      result.current.notifyTypingActivity();
    });
    expect(
      sockets[0].sent.some((raw) => {
        const body = JSON.parse(raw) as { type?: string; is_typing?: boolean };
        return body.type === "typing" && body.is_typing === true;
      }),
    ).toBe(true);

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "typing",
            is_typing: true,
            user: { user_id: 2, full_name: "Bea Board", initials: "BB" },
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.typingUsers).toHaveLength(1));

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "presence",
            action: "left",
            user: { user_id: 2, full_name: "Bea Board", initials: "BB" },
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.presentUsers).toHaveLength(1);
      expect(result.current.typingUsers).toHaveLength(0);
    });
  });

  it("toggles reactions and applies live reaction events", async () => {
    const { result } = renderHook(() =>
      useDiscussion({ type: "board" }, { viewerUserId: 7 }),
    );

    await waitFor(() => expect(sockets).toHaveLength(1));

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "history",
            messages: [
              {
                id: 10,
                content: "Hello",
                event_id: null,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
                reactions: {},
              },
            ],
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      result.current.toggleReaction(10, "👍");
    });
    expect(sockets[0].sent).toContain(
      JSON.stringify({
        type: "reaction",
        message_id: 10,
        emoji: "👍",
        action: "add",
      }),
    );
    // Optimistic — UI updates before the server echo.
    expect(result.current.messages[0].reactions?.["👍"]).toEqual({
      count: 1,
      reacted_by_me: true,
    });

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "reaction",
            message_id: 10,
            user_id: 7,
            emoji: "👍",
            action: "add",
          }),
        }),
      );
    });

    // Echo for own reaction must not double-count.
    expect(result.current.messages[0].reactions?.["👍"]).toEqual({
      count: 1,
      reacted_by_me: true,
    });

    act(() => {
      result.current.toggleReaction(10, "👍");
    });
    expect(sockets[0].sent.at(-1)).toBe(
      JSON.stringify({
        type: "reaction",
        message_id: 10,
        emoji: "👍",
        action: "remove",
      }),
    );
    expect(result.current.messages[0].reactions?.["👍"]).toBeUndefined();

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "reaction",
            message_id: 10,
            user_id: 9,
            emoji: "❤️",
            action: "add",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.messages[0].reactions?.["❤️"]).toEqual({
        count: 1,
        reacted_by_me: false,
      });
    });
  });

  it("tracks read receipts and debounces markLatestAsRead", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useDiscussion({ type: "board" }, { viewerUserId: 1 }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(sockets).toHaveLength(1);

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "history",
            messages: [
              {
                id: 5,
                content: "Hello",
                event_id: null,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
                reactions: {},
              },
            ],
          }),
        }),
      );
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "read_receipts_snapshot",
            receipts: [],
          }),
        }),
      );
    });

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.markLatestAsRead();
      result.current.markLatestAsRead();
    });

    act(() => {
      vi.advanceTimersByTime(2_500);
    });

    expect(
      sockets[0].sent.filter((raw) => {
        const body = JSON.parse(raw) as { type?: string };
        return body.type === "read_receipt";
      }),
    ).toEqual([
      JSON.stringify({ type: "read_receipt", last_read_message_id: 5 }),
    ]);

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "read_receipt",
            user_id: 9,
            room_id: "board",
            last_read_message_id: 5,
            full_name: "Bea Board",
            initials: "BB",
          }),
        }),
      );
    });

    expect(result.current.seenIndicator).toEqual({
      messageId: 5,
      readers: [
        {
          user_id: 9,
          room_id: "board",
          last_read_message_id: 5,
          full_name: "Bea Board",
          initials: "BB",
        },
      ],
    });

    vi.useRealTimers();
  });

  it("parses pinned history and handles pin/edit/reply sends", async () => {
    const { result } = renderHook(() => useDiscussion({ type: "board" }));

    await waitFor(() => expect(sockets).toHaveLength(1));

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "history",
            messages: [
              {
                id: 3,
                content: "Pinned note",
                event_id: null,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
              },
            ],
            pinned: {
              message: {
                id: 3,
                content: "Pinned note",
                event_id: null,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
              },
              pinned_at: "2030-01-01T00:05:00Z",
              pinned_by_name: "Ada",
            },
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.pinnedMessage?.message.id).toBe(3));

    act(() => {
      result.current.sendMessage("With reply", { replyToMessageId: 3 });
      result.current.editMessage(3, "Updated note");
      result.current.pinMessage(3);
    });

    expect(sockets[0].sent).toEqual(
      expect.arrayContaining([
        JSON.stringify({ content: "With reply", reply_to_message_id: 3 }),
        JSON.stringify({
          type: "edit_message",
          message_id: 3,
          content: "Updated note",
        }),
        JSON.stringify({ type: "pin_message", message_id: 3 }),
      ]),
    );

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "pin_updated", pinned: null }),
        }),
      );
    });

    await waitFor(() => expect(result.current.pinnedMessage).toBeNull());

    act(() => {
      result.current.unpinMessage();
    });
    expect(sockets[0].sent.at(-1)).toBe(
      JSON.stringify({ type: "unpin_message" }),
    );
  });

  it("requests older history and prepends history_page messages", async () => {
    const { result } = renderHook(() => useDiscussion({ type: "board" }));

    await waitFor(() => expect(sockets).toHaveLength(1));

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "history",
            messages: Array.from({ length: 50 }, (_, index) => ({
              id: index + 51,
              content: `m${index + 51}`,
              event_id: null,
              created_at: "2030-01-01T00:00:00Z",
              author: { id: 2, full_name: "Board User" },
              reactions: {},
            })),
            first_unread_message_id: 60,
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(50));
    expect(result.current.hasMoreOlder).toBe(true);
    expect(result.current.firstUnreadMessageId).toBe(60);

    act(() => {
      expect(result.current.loadOlderMessages()).toBe(true);
    });
    expect(result.current.loadingOlder).toBe(true);
    expect(sockets[0].sent.at(-1)).toBe(
      JSON.stringify({
        type: "load_history",
        before_id: 51,
        limit: 50,
      }),
    );

    act(() => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "history_page",
            messages: [
              {
                id: 40,
                content: "older",
                event_id: null,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
                reactions: {},
              },
              {
                id: 50,
                content: "mid",
                event_id: null,
                created_at: "2030-01-01T00:00:00Z",
                author: { id: 2, full_name: "Board User" },
                reactions: {},
              },
            ],
            has_more: false,
          }),
        }),
      );
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(52));
    expect(result.current.messages[0]?.id).toBe(40);
    expect(result.current.messages[1]?.id).toBe(50);
    expect(result.current.messages[2]?.id).toBe(51);
    expect(result.current.hasMoreOlder).toBe(false);
    expect(result.current.loadingOlder).toBe(false);
  });
});

describe("prependOlderMessages", () => {
  const base = (id: number): DiscussionMessage => ({
    id,
    content: `m${id}`,
    event_id: null,
    created_at: "2030-01-01T00:00:00Z",
    author: { id: 1, full_name: "Ada" },
    reactions: {},
  });

  it("prepends only unknown older messages", () => {
    const current = [base(3), base(4)];
    const merged = prependOlderMessages(current, [base(1), base(2), base(3)]);
    expect(merged.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it("returns current when older page is empty or fully known", () => {
    const current = [base(3)];
    expect(prependOlderMessages(current, [])).toBe(current);
    expect(prependOlderMessages(current, [base(3)])).toBe(current);
  });
});

describe("resolveFirstUnreadMessageId", () => {
  it("returns the first message after the read watermark", () => {
    const messages = [
      {
        id: 1,
        content: "a",
        event_id: null,
        created_at: "2030-01-01T00:00:00Z",
        author: { id: 1, full_name: "Ada" },
      },
      {
        id: 3,
        content: "b",
        event_id: null,
        created_at: "2030-01-01T00:00:00Z",
        author: { id: 1, full_name: "Ada" },
      },
    ] as DiscussionMessage[];
    expect(resolveFirstUnreadMessageId(messages, 1)).toBe(3);
    expect(resolveFirstUnreadMessageId(messages, 3)).toBeNull();
    expect(resolveFirstUnreadMessageId(messages, null)).toBeNull();
  });
});
