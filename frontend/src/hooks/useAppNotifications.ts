import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  fetchAnnouncements,
  type Announcement,
} from "../lib/announcements-api";
import { getApiErrorMessage } from "../lib/api-error";
import type { NotificationMenuItem } from "../design-system/components/navigation/NotificationMenu";
import {
  markNotificationRead,
  markNotificationsRead,
  readNotificationReadIds,
} from "../lib/notification-read-state";

/**
 * Client-side notification feed derived from announcements (existing API).
 * Read/unread is stored locally — no backend inbox changes.
 */
export function useAppNotifications(enabled: boolean) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readNotificationReadIds(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAnnouncements();
        if (!cancelled) {
          setAnnouncements(response.announcements);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(caught, "Unable to load notifications."),
          );
          setAnnouncements([]);
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
  }, [enabled]);

  const markRead = useCallback((id: string) => {
    setReadIds(markNotificationRead(id));
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((current) => {
      const ids = announcements.map((item) => `announcement-${item.id}`);
      return markNotificationsRead(ids);
    });
  }, [announcements]);

  const items: NotificationMenuItem[] = useMemo(
    () =>
      announcements.map((item) => {
        const id = `announcement-${item.id}`;
        const unread = !readIds.has(id);
        return {
          id,
          title: item.title,
          description: ANNOUNCEMENT_CATEGORY_LABELS[item.category],
          createdAt: item.created_at,
          to: "/announcements",
          unread,
          actions: unread
            ? [
                {
                  id: "mark-read",
                  label: "Mark as read",
                  onClick: () => markRead(id),
                },
              ]
            : undefined,
        };
      }),
    [announcements, readIds, markRead],
  );

  const unreadCount = items.filter((item) => item.unread).length;

  return {
    items,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
  };
}
