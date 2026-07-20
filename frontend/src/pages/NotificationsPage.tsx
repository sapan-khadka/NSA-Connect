import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { getNotificationVisual } from "../design-system/components/navigation/notificationVisuals";
import { EmptyState } from "../design-system/components/data-display/EmptyState";
import { AppIcon } from "../components/ui/AppIcon";
import { Button } from "../components/ui/Button";
import { formatRelativeTimestamp } from "../lib/format-datetime";

export function NotificationsPage() {
  const { inbox, loading, markRead, markAllRead, refresh } =
    useNotificationSummary();

  const hasUnread = inbox.unread_count > 0;
  const items = inbox.notifications;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-label">
            {hasUnread
              ? `${inbox.unread_count} unread · tasks, budget, and announcements`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void markAllRead()}
            disabled={!hasUnread}
          >
            Mark all read
          </Button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-surface-card">
          <EmptyState
            icon={<AppIcon icon={Bell} size="sm" className="text-current" />}
            title="No notifications yet"
            description="When someone assigns you a task, posts an announcement, or needs a budget review, it will appear here."
          />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-surface-card">
          {items.map((item) => {
            const visual = getNotificationVisual(item.type);
            const Icon = visual.icon;

            const content = (
              <span className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    visual.chipClass,
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <Icon
                    className={["h-4 w-4", visual.iconClass].join(" ")}
                    strokeWidth={1.75}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-0.5 block text-sm text-label">
                          {item.body}
                        </span>
                      ) : null}
                      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-label/80">
                        <span>{visual.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTimestamp(item.created_at)}</span>
                      </span>
                    </span>
                    {item.unread ? (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-overdue"
                        aria-label="Unread"
                      />
                    ) : null}
                  </span>
                </span>
              </span>
            );

            const className = [
              "block border-b border-gray-100 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-muted",
              item.unread ? "bg-badge-teal-bg/25" : "",
            ].join(" ");

            if (item.href) {
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={className}
                    onClick={() => {
                      if (item.unread) {
                        void markRead(item.id);
                      }
                    }}
                  >
                    {content}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${className} w-full text-left`}
                  onClick={() => {
                    if (item.unread) {
                      void markRead(item.id);
                    }
                  }}
                >
                  {content}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
