import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { cx } from "../../cx";
import { useDismissibleMenu } from "./useDismissibleMenu";

export type NotificationMenuItem = {
  id: string;
  title: string;
  description?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  unread?: boolean;
};

export type NotificationMenuProps = {
  items?: NotificationMenuItem[];
  /** Unread count badge. Defaults to count of unread items. */
  unreadCount?: number;
  /** Called when an item is activated. */
  onItemSelect?: (item: NotificationMenuItem) => void;
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
  emptyMessage = "No notifications yet.",
  viewAllTo,
  viewAllLabel = "View all",
  className = "",
  trigger,
}: NotificationMenuProps) {
  const { open, setOpen, rootRef, menuId } = useDismissibleMenu();
  const badgeCount =
    unreadCount ?? items.filter((item) => item.unread).length;

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
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-card border border-gray-200 bg-surface-card py-1 shadow-card"
        >
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-label">
              {emptyMessage}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => {
                const body = (
                  <>
                    <span className="block text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    {item.description ? (
                      <span className="mt-0.5 block text-xs text-label">
                        {item.description}
                      </span>
                    ) : null}
                  </>
                );

                const itemClass = cx(
                  "block w-full px-4 py-3 text-left transition-colors hover:bg-surface-muted",
                  item.unread ? "bg-badge-teal-bg/40" : "",
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
            <div className="border-t border-gray-200">
              <Link
                to={viewAllTo}
                role="menuitem"
                className="block px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-surface-muted"
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
