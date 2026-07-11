import { useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "./auth-token";
import type { DiscussionMessage } from "./discussion-api";

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
  return [...current, ...fresh];
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

export function useDiscussion(scope: DiscussionScope | null) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [presentUsers, setPresentUsers] = useState<DiscussionPresenceUser[]>(
    [],
  );
  const [typingUsers, setTypingUsers] = useState<DiscussionPresenceUser[]>([]);
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
  const activeKey = scopeKey(scope);

  scopeRef.current = scope;

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

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendStoppedTyping = useCallback(() => {
    if (!isTypingRef.current) {
      return;
    }
    isTypingRef.current = false;
    sendRaw({ type: "typing", is_typing: false });
  }, [sendRaw]);

  const notifyTypingActivity = useCallback(() => {
    const now = Date.now();
    if (!isTypingRef.current || now - lastTypingSentAtRef.current >= TYPING_DEBOUNCE_MS) {
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
    if (scope == null) {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearHeartbeat();
      clearTypingTimers();
      sendStoppedTyping();
      closeSocket(socketRef.current);
      socketRef.current = null;
      setMessages([]);
      setPresentUsers([]);
      setTypingUsers([]);
      setStatus("closed");
      setLoading(false);
      setError(null);
      return;
    }

    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    backoffRef.current = INITIAL_BACKOFF_MS;
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
          setMessages(payload.messages ?? []);
          setLoading(false);
          setError(null);
          return;
        }

        if (payload.type === "presence_snapshot") {
          setPresentUsers(payload.users ?? []);
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

        if (payload.type === "error") {
          setError(payload.detail || "Discussion error");
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
    connect();

    return () => {
      cancelled = true;
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearHeartbeat();
      clearTypingTimers();
      sendStoppedTyping();
      closeSocket(socketRef.current);
      socketRef.current = null;
      setStatus("closed");
    };
  }, [
    activeKey,
    clearHeartbeat,
    clearReconnectTimer,
    clearTypingTimers,
    clearTypingUser,
    markTypingUser,
    sendRaw,
    sendStoppedTyping,
  ]);

  return {
    messages,
    presentUsers,
    typingUsers,
    status,
    error,
    loading,
    sendMessage,
    notifyTypingActivity,
  };
}

/** Convenience wrapper for event-scoped discussion. */
export function useEventDiscussion(eventId: number | null) {
  return useDiscussion(eventId == null ? null : { type: "event", eventId });
}
