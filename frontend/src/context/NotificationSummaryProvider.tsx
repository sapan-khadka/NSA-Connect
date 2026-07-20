import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "./useAuth";
import type { NotificationMenuItem } from "../design-system/components/navigation/NotificationMenu";
import {
  EMPTY_INBOX,
  EMPTY_NOTIFICATION_SUMMARY,
  fetchInboxNotifications,
  fetchNotificationSummary,
  markAllInboxNotificationsRead,
  markInboxNotificationRead,
  type InboxNotification,
  type InboxNotificationList,
  type NotificationSummary,
} from "../lib/notifications-api";

const POLL_INTERVAL_MS = 60_000;
const BELL_PREVIEW_LIMIT = 8;

type NotificationSummaryContextValue = {
  summary: NotificationSummary;
  inbox: InboxNotificationList;
  loading: boolean;
  refresh: () => void;
  menuItems: NotificationMenuItem[];
  unreadCount: number;
  markRead: (notificationId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationSummaryContext =
  createContext<NotificationSummaryContextValue | null>(null);

function inboxToMenuItems(
  notifications: InboxNotification[],
): NotificationMenuItem[] {
  return notifications.slice(0, BELL_PREVIEW_LIMIT).map((item) => ({
    id: String(item.id),
    title: item.title,
    description: item.body ?? undefined,
    to: item.href ?? undefined,
    unread: item.unread,
    type: item.type,
    createdAt: item.created_at,
  }));
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function NavCountBadge({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={[
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-overdue px-1.5 text-[11px] font-semibold tabular-nums text-white",
        className,
      ].join(" ")}
      aria-label={`${count} pending`}
    >
      {formatBadgeCount(count)}
    </span>
  );
}

export function NotificationSummaryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<NotificationSummary>(
    EMPTY_NOTIFICATION_SUMMARY,
  );
  const [inbox, setInbox] = useState<InboxNotificationList>(EMPTY_INBOX);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSummary(EMPTY_NOTIFICATION_SUMMARY);
      setInbox(EMPTY_INBOX);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [nextSummary, nextInbox] = await Promise.all([
          fetchNotificationSummary(),
          fetchInboxNotifications(50),
        ]);
        if (!cancelled) {
          setSummary(nextSummary);
          setInbox(nextInbox);
        }
      } catch {
        if (!cancelled) {
          setSummary(EMPTY_NOTIFICATION_SUMMARY);
          setInbox(EMPTY_INBOX);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRefreshKey((current) => current + 1);
    }, POLL_INTERVAL_MS);

    function handleFocus() {
      setRefreshKey((current) => current + 1);
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated]);

  const markRead = useCallback(async (notificationId: number) => {
    setInbox((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              unread: false,
              read_at: item.read_at ?? new Date().toISOString(),
            }
          : item,
      ),
      unread_count: Math.max(
        0,
        current.unread_count -
          (current.notifications.find((item) => item.id === notificationId)
            ?.unread
            ? 1
            : 0),
      ),
    }));
    try {
      await markInboxNotificationRead(notificationId);
    } catch {
      setRefreshKey((current) => current + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setInbox((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({
        ...item,
        unread: false,
        read_at: item.read_at ?? new Date().toISOString(),
      })),
      unread_count: 0,
    }));
    try {
      await markAllInboxNotificationsRead();
    } catch {
      setRefreshKey((current) => current + 1);
    }
  }, []);

  const menuItems = useMemo(
    () => inboxToMenuItems(inbox.notifications),
    [inbox.notifications],
  );

  const unreadCount = inbox.unread_count;

  const value = useMemo(
    () => ({
      summary,
      inbox,
      loading,
      refresh,
      menuItems,
      unreadCount,
      markRead,
      markAllRead,
    }),
    [
      summary,
      inbox,
      loading,
      refresh,
      menuItems,
      unreadCount,
      markRead,
      markAllRead,
    ],
  );

  return (
    <NotificationSummaryContext.Provider value={value}>
      {children}
    </NotificationSummaryContext.Provider>
  );
}

export function useNotificationSummary(): NotificationSummaryContextValue {
  const value = useContext(NotificationSummaryContext);
  if (value == null) {
    return {
      summary: EMPTY_NOTIFICATION_SUMMARY,
      inbox: EMPTY_INBOX,
      loading: false,
      refresh: () => undefined,
      menuItems: [],
      unreadCount: 0,
      markRead: async () => undefined,
      markAllRead: async () => undefined,
    };
  }
  return value;
}
