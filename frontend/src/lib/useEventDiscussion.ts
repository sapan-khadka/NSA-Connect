import { useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "./auth-token";
import type {
  DiscussionMessage,
  DiscussionReactionSummary,
} from "./discussion-api";

export type DiscussionStatus = "connecting" | "live" | "reconnecting" | "closed";

/** @deprecated Prefer DiscussionStatus */
export type EventDiscussionStatus = DiscussionStatus;

export type DiscussionScope =
  | { type: "event"; eventId: number }
  | { type: "board" };

export type DiscussionPresenceUser = {
  user_id: number;
  full_name: string;
  initials: string;
};

type HistoryPayload = {
  type: "history";
  messages: DiscussionMessage[];
};

type MessagePayload = {
  type: "message";
  message: DiscussionMessage;
};

type ReactionPayload = {
  type: "reaction";
  message_id: number;
  user_id: number;
  emoji: string;
  action: "add" | "remove";
};

export type DiscussionReadReceipt = {
  user_id: number;
  room_id: string;
  last_read_message_id: number;
  full_name: string;
  initials: string;
};

type ReadReceiptsSnapshotPayload = {
  type: "read_receipts_snapshot";
  receipts: DiscussionReadReceipt[];
};

type ReadReceiptPayload = {
  type: "read_receipt";
  user_id: number;
  room_id: string;
  last_read_message_id: number;
  full_name?: string;
  initials?: string;
};

type PresenceSnapshotPayload = {
  type: "presence_snapshot";
  users: DiscussionPresenceUser[];
};

type PresencePayload = {
  type: "presence";
  action: "joined" | "left";
  user: DiscussionPresenceUser;
};

type TypingPayload = {
  type: "typing";
  is_typing: boolean;
  user: DiscussionPresenceUser;
};

type ErrorPayload = {
  type: "error";
  detail: string;
};

type ServerPayload =
  | HistoryPayload
  | MessagePayload
  | ReactionPayload
  | ReadReceiptsSnapshotPayload
  | ReadReceiptPayload
  | PresenceSnapshotPayload
  | PresencePayload
  | TypingPayload
  | ErrorPayload;

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 15_000;
const MAX_RECONNECT_ATTEMPTS = 8;
const TYPING_DEBOUNCE_MS = 2_000;
const TYPING_IDLE_MS = 3_000;
const TYPING_EXPIRE_MS = 5_000;
const PRESENCE_HEARTBEAT_MS = 15_000;
const READ_RECEIPT_DEBOUNCE_MS = 2_500;

function scopeKey(scope: DiscussionScope | null): string | null {
  if (scope == null) {
    return null;
  }
  return scope.type === "board" ? "board" : `event:${scope.eventId}`;
}

function buildDiscussionWsUrl(scope: DiscussionScope, token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const params = new URLSearchParams({ token });
  const path =
    scope.type === "board"
      ? "/ws/board/discussion"
      : `/ws/events/${scope.eventId}/discussion`;
  return `${protocol}//${host}${path}?${params.toString()}`;
}

function normalizeReactions(
  reactions: DiscussionMessage["reactions"],
): Record<string, DiscussionReactionSummary> {
  return reactions ?? {};
}

function mergeMessages(
  current: DiscussionMessage[],
  incoming: DiscussionMessage[],
): DiscussionMessage[] {
  if (incoming.length === 0) {
    return current;
  }
  const knownIds = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !knownIds.has(message.id));
  if (fresh.length === 0) {
    return current;
  }
  return [
    ...current,
    ...fresh.map((message) => ({
      ...message,
      reactions: normalizeReactions(message.reactions),
    })),
  ];
}

/** Exported for unit tests. */
export function applyReactionEvent(
  current: DiscussionMessage[],
  payload: ReactionPayload,
  viewerUserId: number | null,
): DiscussionMessage[] {
  return current.map((message) => {
    if (message.id !== payload.message_id) {
      return message;
    }

    const reactions = { ...normalizeReactions(message.reactions) };
    const existing = reactions[payload.emoji];
    const isViewer = viewerUserId != null && payload.user_id === viewerUserId;

    if (payload.action === "add") {
      reactions[payload.emoji] = {
        count: (existing?.count ?? 0) + 1,
        reacted_by_me: isViewer ? true : Boolean(existing?.reacted_by_me),
      };
    } else {
      const nextCount = Math.max(0, (existing?.count ?? 0) - 1);
      if (nextCount === 0) {
        delete reactions[payload.emoji];
      } else {
        reactions[payload.emoji] = {
          count: nextCount,
          reacted_by_me: isViewer ? false : Boolean(existing?.reacted_by_me),
        };
      }
    }

    return { ...message, reactions };
  });
}

function upsertPresence(
  current: DiscussionPresenceUser[],
  user: DiscussionPresenceUser,
): DiscussionPresenceUser[] {
  const without = current.filter((row) => row.user_id !== user.user_id);
  return [...without, user].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }),
  );
}

/** Exported for unit tests. */
export function upsertReadReceipt(
  current: DiscussionReadReceipt[],
  incoming: DiscussionReadReceipt,
): DiscussionReadReceipt[] {
  const without = current.filter((row) => row.user_id !== incoming.user_id);
  return [...without, incoming].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }),
  );
}

/**
 * Lightweight group seen indicator: one cluster at the furthest message
 * other participants have read up to (excluding the viewer).
 */
export function getSeenIndicator(
  messages: DiscussionMessage[],
  receipts: DiscussionReadReceipt[],
  viewerUserId: number | null,
): { messageId: number; readers: DiscussionReadReceipt[] } | null {
  if (messages.length === 0) {
    return null;
  }
  const messageIds = new Set(messages.map((message) => message.id));
  const others = receipts.filter(
    (receipt) =>
      receipt.user_id !== viewerUserId &&
      messageIds.has(receipt.last_read_message_id),
  );
  if (others.length === 0) {
    return null;
  }
  const frontier = Math.max(
    ...others.map((receipt) => receipt.last_read_message_id),
  );
  const readers = others.filter(
    (receipt) => receipt.last_read_message_id === frontier,
  );
  if (readers.length === 0) {
    return null;
  }
  return { messageId: frontier, readers };
}

function closeSocket(socket: WebSocket | null): void {
  if (!socket) {
    return;
  }
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  if (
    socket.readyState === WebSocket.CONNECTING ||
    socket.readyState === WebSocket.OPEN
  ) {
    try {
      socket.close();
    } catch {
      // Ignore close races during teardown.
    }
  }
}

function pendingReactionKey(
  messageId: number,
  emoji: string,
  action: "add" | "remove",
  userId: number,
): string {
  return `${messageId}:${emoji}:${action}:${userId}`;
}

export function useDiscussion(
  scope: DiscussionScope | null,
  options?: { viewerUserId?: number | null },
) {
  const viewerUserId = options?.viewerUserId ?? null;
  const viewerUserIdRef = useRef(viewerUserId);
  viewerUserIdRef.current = viewerUserId;

  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [presentUsers, setPresentUsers] = useState<DiscussionPresenceUser[]>(
    [],
  );
  const [typingUsers, setTypingUsers] = useState<DiscussionPresenceUser[]>([]);
  const [readReceipts, setReadReceipts] = useState<DiscussionReadReceipt[]>(
    [],
  );
  const [status, setStatus] = useState<DiscussionStatus>("closed");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(scope));

  const socketRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const scopeRef = useRef(scope);
  const typingExpireTimersRef = useRef<Map<number, number>>(new Map());
  const lastTypingSentAtRef = useRef(0);
  const typingIdleTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);
  const messagesRef = useRef(messages);
  const tabFocusedRef = useRef(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const lastSentReadIdRef = useRef<number | null>(null);
  const pendingReadIdRef = useRef<number | null>(null);
  const readDebounceTimerRef = useRef<number | null>(null);
  const pendingReactionsRef = useRef<
    Map<
      string,
      { messageId: number; emoji: string; action: "add" | "remove" }
    >
  >(new Map());
  const activeKey = scopeKey(scope);

  scopeRef.current = scope;
  messagesRef.current = messages;

  const rollbackPendingReactions = useCallback(() => {
    const viewerId = viewerUserIdRef.current;
    if (viewerId == null || pendingReactionsRef.current.size === 0) {
      return;
    }
    const pending = [...pendingReactionsRef.current.values()];
    pendingReactionsRef.current.clear();
    for (const op of pending) {
      const inverse = op.action === "add" ? "remove" : "add";
      setMessages((current) =>
        applyReactionEvent(
          current,
          {
            type: "reaction",
            message_id: op.messageId,
            user_id: viewerId,
            emoji: op.emoji,
            action: inverse,
          },
          viewerId,
        ),
      );
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearTypingTimers = useCallback(() => {
    if (typingIdleTimerRef.current != null) {
      window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    for (const timerId of typingExpireTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    typingExpireTimersRef.current.clear();
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current != null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const clearReadDebounce = useCallback(() => {
    if (readDebounceTimerRef.current != null) {
      window.clearTimeout(readDebounceTimerRef.current);
      readDebounceTimerRef.current = null;
    }
  }, []);

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const flushReadReceipt = useCallback(() => {
    const messageId = pendingReadIdRef.current;
    if (messageId == null) {
      return;
    }
    if (
      lastSentReadIdRef.current != null &&
      messageId <= lastSentReadIdRef.current
    ) {
      return;
    }
    if (!tabFocusedRef.current) {
      return;
    }
    if (
      sendRaw({
        type: "read_receipt",
        last_read_message_id: messageId,
      })
    ) {
      lastSentReadIdRef.current = messageId;
    }
  }, [sendRaw]);

  const scheduleReadReceipt = useCallback(
    (messageId: number) => {
      if (
        lastSentReadIdRef.current != null &&
        messageId <= lastSentReadIdRef.current
      ) {
        return;
      }
      pendingReadIdRef.current = Math.max(
        pendingReadIdRef.current ?? 0,
        messageId,
      );
      if (!tabFocusedRef.current) {
        return;
      }
      clearReadDebounce();
      readDebounceTimerRef.current = window.setTimeout(() => {
        readDebounceTimerRef.current = null;
        flushReadReceipt();
      }, READ_RECEIPT_DEBOUNCE_MS);
    },
    [clearReadDebounce, flushReadReceipt],
  );

  /** Call when the discussion is scrolled near the bottom / actively viewed. */
  const markLatestAsRead = useCallback(() => {
    const latest = messagesRef.current.at(-1);
    if (latest) {
      scheduleReadReceipt(latest.id);
    }
  }, [scheduleReadReceipt]);

  const sendStoppedTyping = useCallback(() => {
    if (!isTypingRef.current) {
      return;
    }
    isTypingRef.current = false;
    sendRaw({ type: "typing", is_typing: false });
  }, [sendRaw]);

  const notifyTypingActivity = useCallback(() => {
    const now = Date.now();
    if (
      !isTypingRef.current ||
      now - lastTypingSentAtRef.current >= TYPING_DEBOUNCE_MS
    ) {
      isTypingRef.current = true;
      lastTypingSentAtRef.current = now;
      sendRaw({ type: "typing", is_typing: true });
    }

    if (typingIdleTimerRef.current != null) {
      window.clearTimeout(typingIdleTimerRef.current);
    }
    typingIdleTimerRef.current = window.setTimeout(() => {
      sendStoppedTyping();
    }, TYPING_IDLE_MS);
  }, [sendRaw, sendStoppedTyping]);

  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      const trimmed = content.trim();
      if (!socket || socket.readyState !== WebSocket.OPEN || !trimmed) {
        throw new Error("Discussion is not connected");
      }
      sendStoppedTyping();
      socket.send(JSON.stringify({ content: trimmed }));
    },
    [sendStoppedTyping],
  );

  const toggleReaction = useCallback(
    (messageId: number, emoji: string) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      const viewerId = viewerUserIdRef.current;
      if (viewerId == null) {
        return;
      }

      const message = messagesRef.current.find((row) => row.id === messageId);
      const alreadyReacted = Boolean(message?.reactions?.[emoji]?.reacted_by_me);
      const action: "add" | "remove" = alreadyReacted ? "remove" : "add";
      const key = pendingReactionKey(messageId, emoji, action, viewerId);

      // Optimistic local update — WS echo is deduped via pendingReactionsRef.
      setMessages((current) =>
        applyReactionEvent(
          current,
          {
            type: "reaction",
            message_id: messageId,
            user_id: viewerId,
            emoji,
            action,
          },
          viewerId,
        ),
      );
      pendingReactionsRef.current.set(key, { messageId, emoji, action });

      try {
        socket.send(
          JSON.stringify({
            type: "reaction",
            message_id: messageId,
            emoji,
            action,
          }),
        );
      } catch {
        pendingReactionsRef.current.delete(key);
        const inverse = action === "add" ? "remove" : "add";
        setMessages((current) =>
          applyReactionEvent(
            current,
            {
              type: "reaction",
              message_id: messageId,
              user_id: viewerId,
              emoji,
              action: inverse,
            },
            viewerId,
          ),
        );
        setError("Failed to send reaction");
      }
    },
    [],
  );

  const markTypingUser = useCallback((user: DiscussionPresenceUser) => {
    setTypingUsers((current) => upsertPresence(current, user));
    const existing = typingExpireTimersRef.current.get(user.user_id);
    if (existing != null) {
      window.clearTimeout(existing);
    }
    const timerId = window.setTimeout(() => {
      typingExpireTimersRef.current.delete(user.user_id);
      setTypingUsers((current) =>
        current.filter((row) => row.user_id !== user.user_id),
      );
    }, TYPING_EXPIRE_MS);
    typingExpireTimersRef.current.set(user.user_id, timerId);
  }, []);

  const clearTypingUser = useCallback((userId: number) => {
    const existing = typingExpireTimersRef.current.get(userId);
    if (existing != null) {
      window.clearTimeout(existing);
      typingExpireTimersRef.current.delete(userId);
    }
    setTypingUsers((current) => current.filter((row) => row.user_id !== userId));
  }, []);

  useEffect(() => {
    function syncFocus() {
      // Page Visibility is the reliable "tab focused" signal (hasFocus() is
      // false in jsdom and when DevTools steals focus).
      const focused = document.visibilityState === "visible";
      tabFocusedRef.current = focused;
      if (focused) {
        const latest = messagesRef.current.at(-1);
        if (latest) {
          scheduleReadReceipt(latest.id);
        }
      }
    }
    syncFocus();
    document.addEventListener("visibilitychange", syncFocus);
    return () => {
      document.removeEventListener("visibilitychange", syncFocus);
    };
  }, [scheduleReadReceipt]);

  useEffect(() => {
    if (scope == null) {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearHeartbeat();
      clearTypingTimers();
      clearReadDebounce();
      sendStoppedTyping();
      closeSocket(socketRef.current);
      socketRef.current = null;
      setMessages([]);
      setPresentUsers([]);
      setTypingUsers([]);
      setReadReceipts([]);
      lastSentReadIdRef.current = null;
      pendingReadIdRef.current = null;
      setStatus("closed");
      setLoading(false);
      setError(null);
      return;
    }

    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    backoffRef.current = INITIAL_BACKOFF_MS;
    lastSentReadIdRef.current = null;
    pendingReadIdRef.current = null;
    let cancelled = false;

    function scheduleReconnect() {
      if (cancelled || intentionalCloseRef.current || scopeRef.current == null) {
        return;
      }
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus("closed");
        setLoading(false);
        setError("Discussion connection lost. Refresh the page to retry.");
        return;
      }

      reconnectAttemptsRef.current += 1;
      setStatus("reconnecting");
      clearReconnectTimer();
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    }

    function connect() {
      const currentScope = scopeRef.current;
      if (cancelled || intentionalCloseRef.current || currentScope == null) {
        return;
      }

      const token = getAccessToken();
      if (!token) {
        setError("Not signed in");
        setStatus("closed");
        setLoading(false);
        return;
      }

      clearHeartbeat();
      closeSocket(socketRef.current);
      socketRef.current = null;

      setStatus((current) =>
        current === "reconnecting" ? "reconnecting" : "connecting",
      );
      setError(null);

      const socket = new WebSocket(buildDiscussionWsUrl(currentScope, token));
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled || socketRef.current !== socket) {
          return;
        }
        backoffRef.current = INITIAL_BACKOFF_MS;
        reconnectAttemptsRef.current = 0;
        setStatus("live");
        clearHeartbeat();
        heartbeatTimerRef.current = window.setInterval(() => {
          sendRaw({ type: "presence_heartbeat" });
        }, PRESENCE_HEARTBEAT_MS);
      };

      socket.onmessage = (event) => {
        if (cancelled || socketRef.current !== socket) {
          return;
        }

        let payload: ServerPayload;
        try {
          payload = JSON.parse(String(event.data)) as ServerPayload;
        } catch {
          return;
        }

        if (payload.type === "history") {
          setMessages(
            (payload.messages ?? []).map((message) => ({
              ...message,
              reactions: normalizeReactions(message.reactions),
            })),
          );
          setLoading(false);
          setError(null);
          return;
        }

        if (payload.type === "presence_snapshot") {
          setPresentUsers(payload.users ?? []);
          return;
        }

        if (payload.type === "read_receipts_snapshot") {
          const receipts = payload.receipts ?? [];
          setReadReceipts(receipts);
          const mine = receipts.find(
            (receipt) => receipt.user_id === viewerUserIdRef.current,
          );
          if (mine) {
            lastSentReadIdRef.current = Math.max(
              lastSentReadIdRef.current ?? 0,
              mine.last_read_message_id,
            );
          }
          return;
        }

        if (payload.type === "presence" && payload.user) {
          if (payload.action === "joined") {
            setPresentUsers((current) => upsertPresence(current, payload.user));
          } else if (payload.action === "left") {
            setPresentUsers((current) =>
              current.filter((row) => row.user_id !== payload.user.user_id),
            );
            clearTypingUser(payload.user.user_id);
          }
          return;
        }

        if (payload.type === "typing" && payload.user) {
          if (payload.is_typing) {
            markTypingUser(payload.user);
          } else {
            clearTypingUser(payload.user.user_id);
          }
          return;
        }

        if (payload.type === "message" && payload.message) {
          setMessages((current) => mergeMessages(current, [payload.message]));
          setLoading(false);
          if (payload.message.author?.id != null) {
            clearTypingUser(payload.message.author.id);
          }
          return;
        }

        if (payload.type === "reaction") {
          const viewerId = viewerUserIdRef.current;
          if (viewerId != null) {
            const key = pendingReactionKey(
              payload.message_id,
              payload.emoji,
              payload.action,
              payload.user_id,
            );
            // Own optimistic update already applied — skip echo to avoid double-count.
            if (
              payload.user_id === viewerId &&
              pendingReactionsRef.current.has(key)
            ) {
              pendingReactionsRef.current.delete(key);
              return;
            }
          }
          setMessages((current) =>
            applyReactionEvent(current, payload, viewerUserIdRef.current),
          );
          return;
        }

        if (payload.type === "read_receipt") {
          const roomId =
            payload.room_id ||
            (scopeRef.current
              ? scopeRef.current.type === "board"
                ? "board"
                : `event:${scopeRef.current.eventId}`
              : "");
          const incoming: DiscussionReadReceipt = {
            user_id: payload.user_id,
            room_id: roomId,
            last_read_message_id: payload.last_read_message_id,
            full_name: payload.full_name ?? "Member",
            initials: payload.initials ?? "?",
          };
          setReadReceipts((current) => upsertReadReceipt(current, incoming));
          if (payload.user_id === viewerUserIdRef.current) {
            lastSentReadIdRef.current = Math.max(
              lastSentReadIdRef.current ?? 0,
              payload.last_read_message_id,
            );
          }
          return;
        }

        if (payload.type === "error") {
          const detail = payload.detail || "Discussion error";
          setError(detail);
          if (/reaction/i.test(detail)) {
            rollbackPendingReactions();
          }
        }
      };

      socket.onerror = () => {
        // onclose handles reconnect.
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        clearHeartbeat();
        if (cancelled || intentionalCloseRef.current) {
          setStatus("closed");
          return;
        }
        if (event.code === 4001 || event.code === 4003) {
          setError(
            event.code === 4001
              ? "Discussion authentication failed"
              : "You do not have access to this discussion",
          );
          setStatus("closed");
          setLoading(false);
          return;
        }
        scheduleReconnect();
      };
    }

    setLoading(true);
    setMessages([]);
    setPresentUsers([]);
    setTypingUsers([]);
    setReadReceipts([]);
    pendingReactionsRef.current.clear();
    connect();

    return () => {
      cancelled = true;
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearHeartbeat();
      clearTypingTimers();
      clearReadDebounce();
      sendStoppedTyping();
      closeSocket(socketRef.current);
      socketRef.current = null;
      setStatus("closed");
    };
  }, [
    activeKey,
    clearHeartbeat,
    clearReadDebounce,
    clearReconnectTimer,
    clearTypingTimers,
    clearTypingUser,
    markTypingUser,
    rollbackPendingReactions,
    sendRaw,
    sendStoppedTyping,
  ]);

  const seenIndicator = getSeenIndicator(
    messages,
    readReceipts,
    viewerUserId,
  );

  return {
    messages,
    presentUsers,
    typingUsers,
    readReceipts,
    seenIndicator,
    status,
    error,
    loading,
    sendMessage,
    toggleReaction,
    markLatestAsRead,
    notifyTypingActivity,
  };
}

/** Convenience wrapper for event-scoped discussion. */
export function useEventDiscussion(
  eventId: number | null,
  options?: { viewerUserId?: number | null },
) {
  return useDiscussion(
    eventId == null ? null : { type: "event", eventId },
    options,
  );
}
