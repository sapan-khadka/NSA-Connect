import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { cx } from "../../cx";
import { getNotificationVisual } from "./notificationVisuals";
import { useDismissibleMenu } from "./useDismissibleMenu";

function formatMenuRelativeTime(isoDate: string, now = new Date()): string {
  const then = new Date(isoDate).getTime();
  const diffSeconds = Math.round((now.getTime() - then) / 1000);
  if (!Number.isFinite(diffSeconds)) {
    return "";
  }
  if (diffSeconds < 45) {
    return "just now";
  }
  if (diffSeconds < 90) {
    return "1 min ago";
  }
  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)} min ago`;
  }
  if (diffSeconds < 86400) {
    return `${Math.floor(diffSeconds / 3600)} hr ago`;
  }
  if (diffSeconds < 172800) {
    return "yesterday";
  }
  if (diffSeconds < 604800) {
    return `${Math.floor(diffSeconds / 86400)} days ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

export type NotificationMenuItem = {
  id: string;
  title: string;
  description?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  unread?: boolean;
  type?: string;
  createdAt?: string;
};

export type NotificationMenuProps = {
  items?: NotificationMenuItem[];
  /** Unread count badge. Defaults to count of unread items. */
  unreadCount?: number;
  /** Called when an item is activated. */
  onItemSelect?: (item: NotificationMenuItem) => void;
  /** Mark all notifications as read. */
  onMarkAllRead?: () => void;
  /** Fallback when the menu is empty. */
  emptyMessage?: string;
  /** Optional “View all” destination. */
  viewAllTo?: string;
  viewAllLabel?: string;
  className?: string;
  /** Custom trigger; defaults to bell button. */
  trigger?: ReactNode;
};

/**
 * Notification bell with dismissible dropdown. Configurable items — no data fetching.
 */
export function NotificationMenu({
  items = [],
  unreadCount,
  onItemSelect,
  onMarkAllRead,
  emptyMessage = "You're all caught up.",
  viewAllTo,
  viewAllLabel = "View all",
  className = "",
  trigger,
}: NotificationMenuProps) {
  const { open, setOpen, rootRef, menuId } = useDismissibleMenu();
  const badgeCount =
    unreadCount ?? items.filter((item) => item.unread).length;
  const hasUnread = badgeCount > 0;

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      {trigger ? (
        <span
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((current) => !current);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
        >
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          aria-label={
            badgeCount > 0
              ? `Notifications, ${badgeCount} unread`
              : "Notifications"
          }
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-label transition duration-200 hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {badgeCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-overdue px-1 text-[10px] font-semibold text-white">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </button>
      )}

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-gray-200 bg-surface-card shadow-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Notifications
              </p>
              <p className="text-[11px] text-label">
                {hasUnread
                  ? `${badgeCount} unread`
                  : "You're up to date"}
              </p>
            </div>
            {onMarkAllRead ? (
              <button
                type="button"
                disabled={!hasUnread}
                className="text-xs font-semibold text-primary transition enabled:hover:text-primary-hover disabled:cursor-default disabled:text-label/50"
                onClick={() => {
                  onMarkAllRead();
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-label">
              {emptyMessage}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => {
                const visual = getNotificationVisual(item.type);
                const Icon = visual.icon;

                const body = (
                  <span className="flex items-start gap-3">
                    <span
                      className={cx(
                        "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        visual.chipClass,
                      )}
                      aria-hidden="true"
                    >
                      <Icon
                        className={cx("h-3.5 w-3.5", visual.iconClass)}
                        strokeWidth={1.75}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="block text-sm font-medium leading-snug text-foreground">
                          {item.title}
                        </span>
                        {item.unread ? (
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-overdue"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block truncate text-xs text-label">
                          {item.description}
                        </span>
                      ) : null}
                      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-label/80">
                        <span>{visual.label}</span>
                        {item.createdAt ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {formatMenuRelativeTime(item.createdAt)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </span>
                );

                const itemClass = cx(
                  "block w-full px-4 py-3 text-left transition-colors hover:bg-surface-muted",
                  item.unread ? "bg-badge-teal-bg/25" : "",
                );

                function activate() {
                  onItemSelect?.(item);
                  item.onClick?.();
                  setOpen(false);
                }

                return (
                  <li key={item.id} role="none">
                    {item.to ? (
                      <Link
                        to={item.to}
                        role="menuitem"
                        className={itemClass}
                        onClick={activate}
                      >
                        {body}
                      </Link>
                    ) : item.href ? (
                      <a
                        href={item.href}
                        role="menuitem"
                        className={itemClass}
                        onClick={activate}
                      >
                        {body}
                      </a>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        className={itemClass}
                        onClick={activate}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {viewAllTo ? (
            <div className="border-t border-gray-100">
              <Link
                to={viewAllTo}
                role="menuitem"
                className="block px-4 py-3 text-center text-sm font-semibold text-primary transition hover:bg-surface-muted"
                onClick={() => setOpen(false)}
              >
                {viewAllLabel}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
