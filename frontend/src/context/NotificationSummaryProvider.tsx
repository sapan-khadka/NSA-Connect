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
import { FINANCE_APPROVALS_PATH } from "../lib/finance-routes";
import {
  EMPTY_NOTIFICATION_SUMMARY,
  fetchNotificationSummary,
  type NotificationSummary,
} from "../lib/notifications-api";

const POLL_INTERVAL_MS = 60_000;

type NotificationSummaryContextValue = {
  summary: NotificationSummary;
  loading: boolean;
  refresh: () => void;
  menuItems: NotificationMenuItem[];
};

const NotificationSummaryContext =
  createContext<NotificationSummaryContextValue | null>(null);

function buildMenuItems(summary: NotificationSummary): NotificationMenuItem[] {
  const items: NotificationMenuItem[] = [];

  if (summary.members_pending > 0) {
    items.push({
      id: "members-pending",
      title:
        summary.members_pending === 1
          ? "1 member awaiting approval"
          : `${summary.members_pending} members awaiting approval`,
      description: "Review pending membership requests",
      to: "/members?tab=pending",
      unread: true,
    });
  }

  if (summary.finance_pending > 0) {
    items.push({
      id: "finance-pending",
      title:
        summary.finance_pending === 1
          ? "1 finance change to review"
          : `${summary.finance_pending} finance changes to review`,
      description: "Approve or reject pending edits",
      to: FINANCE_APPROVALS_PATH,
      unread: true,
    });
  }

  if (summary.suggestions_pending > 0) {
    items.push({
      id: "suggestions-pending",
      title:
        summary.suggestions_pending === 1
          ? "1 event suggestion submitted"
          : `${summary.suggestions_pending} event suggestions submitted`,
      description: "Review member ideas",
      to: "/events/suggestions",
      unread: true,
    });
  }

  if (summary.discussions_unread > 0) {
    items.push({
      id: "discussions-unread",
      title:
        summary.discussions_unread === 1
          ? "1 unread discussion message"
          : `${summary.discussions_unread} unread discussion messages`,
      description: "Catch up on board and event chats",
      to: "/discussions",
      unread: true,
    });
  }

  if (summary.tasks_overdue > 0) {
    items.push({
      id: "tasks-overdue",
      title:
        summary.tasks_overdue === 1
          ? "1 overdue task"
          : `${summary.tasks_overdue} overdue tasks`,
      description: "Complete or update overdue work",
      to: "/events/tasks",
      unread: true,
    });
  } else if (summary.tasks_due_today > 0) {
    items.push({
      id: "tasks-due-today",
      title:
        summary.tasks_due_today === 1
          ? "1 task due today"
          : `${summary.tasks_due_today} tasks due today`,
      description: "Stay on top of today's assignments",
      to: "/events/tasks",
      unread: true,
    });
  }

  return items;
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
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSummary(EMPTY_NOTIFICATION_SUMMARY);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const next = await fetchNotificationSummary();
        if (!cancelled) {
          setSummary(next);
        }
      } catch {
        if (!cancelled) {
          setSummary(EMPTY_NOTIFICATION_SUMMARY);
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

  const menuItems = useMemo(() => buildMenuItems(summary), [summary]);

  const value = useMemo(
    () => ({
      summary,
      loading,
      refresh,
      menuItems,
    }),
    [summary, loading, refresh, menuItems],
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
      loading: false,
      refresh: () => undefined,
      menuItems: [],
    };
  }
  return value;
}
