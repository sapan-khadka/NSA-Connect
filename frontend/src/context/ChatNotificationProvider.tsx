import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "./useAuth";
import { useNotificationSummary } from "./NotificationSummaryProvider";
import { useToast } from "./ToastProvider";
import { fetchDiscussionWsTicket } from "../lib/discussion-api";
import { getAccessToken } from "../lib/auth-token";

const HEARTBEAT_MS = 20_000;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 20_000;

type DiscussionMessageNotifyPayload = {
  type: "discussion_message";
  notification_id?: number | null;
  room_id?: string;
  title?: string;
  body?: string | null;
  href?: string | null;
  author_name?: string;
  message_id?: number;
};

function buildNotifyWsUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const params = new URLSearchParams({ token });
  return `${protocol}//${host}/ws/notifications?${params.toString()}`;
}

function roomIdFromPath(pathname: string): string | null {
  if (pathname === "/discussions/board") {
    return "board";
  }
  const eventMatch = pathname.match(/^\/discussions\/event\/(\d+)$/);
  if (eventMatch) {
    return `event:${eventMatch[1]}`;
  }
  const roomMatch = pathname.match(/^\/discussions\/room\/(\d+)$/);
  if (roomMatch) {
    return `room:${roomMatch[1]}`;
  }
  return null;
}

function ensureBrowserNotificationPermission() {
  if (typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

/**
 * Keeps a user-level notifications socket open and surfaces chat alerts
 * like WhatsApp/Instagram (toast when app focused, OS banner when backgrounded).
 */
export function ChatNotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { pushToast } = useToast();
  const { refresh } = useNotificationSummary();
  const location = useLocation();
  const navigate = useNavigate();
  const activeRoomId = roomIdFromPath(location.pathname);
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isAuthenticated || !getAccessToken()) {
      return;
    }

    ensureBrowserNotificationPermission();

    let cancelled = false;
    let socket: WebSocket | null = null;
    let heartbeatTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let backoff = INITIAL_BACKOFF_MS;

    function clearHeartbeat() {
      if (heartbeatTimer != null) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function clearReconnect() {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function handlePayload(payload: DiscussionMessageNotifyPayload) {
      if (payload.type !== "discussion_message") {
        return;
      }
      const roomId = payload.room_id ?? null;
      if (roomId && roomId === activeRoomIdRef.current) {
        refreshRef.current();
        return;
      }

      const title = payload.title?.trim() || "New message";
      const body = payload.body?.trim() || undefined;
      const href = payload.href ?? undefined;

      refreshRef.current();

      if (typeof document !== "undefined" && document.hidden) {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          const notification = new Notification(title, {
            body,
            tag: roomId ?? href ?? title,
            silent: false,
          });
          notification.onclick = () => {
            window.focus();
            if (href) {
              navigateRef.current(href);
            }
            notification.close();
          };
        }
        return;
      }

      pushToastRef.current({
        id: roomId ? `chat-${roomId}` : undefined,
        title,
        description: body,
        href,
        tone: "info",
      });
    }

    async function connect() {
      if (cancelled) {
        return;
      }
      let ticket: string;
      try {
        const issued = await fetchDiscussionWsTicket();
        ticket = issued.token;
      } catch {
        scheduleReconnect();
        return;
      }
      if (cancelled) {
        return;
      }

      clearHeartbeat();
      if (socket) {
        socket.close();
        socket = null;
      }

      const next = new WebSocket(buildNotifyWsUrl(ticket));
      socket = next;

      next.onopen = () => {
        if (cancelled || socket !== next) {
          return;
        }
        backoff = INITIAL_BACKOFF_MS;
        clearHeartbeat();
        heartbeatTimer = window.setInterval(() => {
          if (next.readyState === WebSocket.OPEN) {
            next.send(JSON.stringify({ type: "presence_heartbeat" }));
          }
        }, HEARTBEAT_MS);
      };

      next.onmessage = (event) => {
        if (cancelled || socket !== next) {
          return;
        }
        try {
          const payload = JSON.parse(
            String(event.data),
          ) as DiscussionMessageNotifyPayload & { type: string };
          if (payload.type === "discussion_message") {
            handlePayload(payload);
          }
        } catch {
          // ignore malformed payloads
        }
      };

      next.onclose = () => {
        if (socket === next) {
          socket = null;
        }
        clearHeartbeat();
        if (!cancelled) {
          scheduleReconnect();
        }
      };
    }

    function scheduleReconnect() {
      if (cancelled) {
        return;
      }
      clearReconnect();
      const delay = backoff;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delay);
    }

    void connect();

    return () => {
      cancelled = true;
      clearHeartbeat();
      clearReconnect();
      if (socket) {
        socket.close();
        socket = null;
      }
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}
