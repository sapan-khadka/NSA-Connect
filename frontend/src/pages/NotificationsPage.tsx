/**
 * Notifications — matches Recent Activity + Announcements list rhythm.
 * Flat feed, compact icons, no heavy card chrome.
 */

import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { AppIcon } from "../components/ui/AppIcon";
import { PageBackLink } from "../components/ui/PageBackLink";
import { formatPersonalActivityWhen } from "../components/home/HomeRecentActivity";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { getNotificationVisual } from "../design-system/components/navigation/notificationVisuals";
import type { InboxNotification } from "../lib/notifications-api";

function NotificationRow({
  item,
  onMarkRead,
}: {
  item: InboxNotification;
  onMarkRead: (id: number) => void;
}) {
  const visual = getNotificationVisual(item.type);
  const Icon = visual.icon;
  const when = formatPersonalActivityWhen(item.created_at);

  const className = [
    "notifications-feed-item",
    item.unread ? "is-unread" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <span
        className={[
          "notifications-feed-icon",
          `notifications-feed-icon--${item.type || "update"}`,
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
      </span>

      <span className="notifications-feed-copy">
        <span className="notifications-feed-meta">
          <span className="notifications-feed-kind">{visual.label}</span>
          <time
            className="notifications-feed-when"
            dateTime={item.created_at}
          >
            {when}
          </time>
        </span>
        <span className="notifications-feed-title">{item.title}</span>
        {item.body ? (
          <span className="notifications-feed-body">{item.body}</span>
        ) : null}
      </span>

      {item.unread ? (
        <span className="notifications-feed-dot" aria-label="Unread" />
      ) : (
        <span className="notifications-feed-dot-spacer" aria-hidden="true" />
      )}
    </>
  );

  if (item.href) {
    return (
      <Link
        to={item.href}
        className={className}
        onClick={() => {
          if (item.unread) {
            onMarkRead(item.id);
          }
        }}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${className} w-full text-left`}
      onClick={() => {
        if (item.unread) {
          onMarkRead(item.id);
        }
      }}
    >
      {body}
    </button>
  );
}

function NotificationSection({
  label,
  items,
  onMarkRead,
}: {
  label: string;
  items: InboxNotification[];
  onMarkRead: (id: number) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="notifications-feed-section" aria-label={label}>
      <h2 className="notifications-feed-section-title">{label}</h2>
      <ul className="notifications-feed-list">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow item={item} onMarkRead={onMarkRead} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotificationsPage() {
  const { inbox, loading, markRead, markAllRead, refresh } =
    useNotificationSummary();
  const [markingAll, setMarkingAll] = useState(false);

  const items = inbox.notifications;
  // Prefer list flags; unread_count can lag behind optimistic row updates.
  const unreadItems = items.filter((item) => item.unread);
  const earlierItems = items.filter((item) => !item.unread);
  const unreadTotal = Math.max(inbox.unread_count, unreadItems.length);
  const hasUnread = unreadTotal > 0;

  async function handleMarkAllRead() {
    if (!hasUnread || markingAll) {
      return;
    }
    setMarkingAll(true);
    try {
      await markAllRead();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="notifications-page">
      <header className="notifications-page__head">
        <div className="min-w-0">
          <PageBackLink
            to="/"
            label="Home"
            historyFirst
            className="mb-2.5"
          />
          <h1 className="notifications-page__title">Notifications</h1>
          <p className="notifications-page__subtitle">
            {hasUnread
              ? `${unreadTotal} unread · tasks, budget, and board updates`
              : "You're all caught up."}
          </p>
        </div>
        <div className="notifications-page__actions">
          <button
            type="button"
            className="notifications-page__action"
            onClick={() => refresh()}
            disabled={loading || markingAll}
          >
            <AppIcon icon={RefreshCw} size="xs" className="text-current" />
            Refresh
          </button>
          {hasUnread ? (
            <button
              type="button"
              className="notifications-page__action is-primary"
              onClick={() => void handleMarkAllRead()}
              disabled={markingAll}
              aria-busy={markingAll}
            >
              <AppIcon icon={CheckCheck} size="xs" className="text-current" />
              {markingAll ? "Marking…" : "Mark all read"}
            </button>
          ) : null}
        </div>
      </header>

      {loading && items.length === 0 ? (
        <p className="notifications-page__empty">Loading…</p>
      ) : items.length === 0 ? (
        <div className="notifications-page__empty-state">
          <span className="notifications-page__empty-icon" aria-hidden="true">
            <AppIcon icon={Bell} size="sm" className="text-current" />
          </span>
          <p className="notifications-page__empty-title">Nothing here yet</p>
          <p className="notifications-page__empty-copy">
            Task assignments, announcements, budget reviews, and board messages
            will land here.
          </p>
        </div>
      ) : hasUnread ? (
        <div className="notifications-feed">
          <NotificationSection
            label="Unread"
            items={unreadItems}
            onMarkRead={(id) => void markRead(id)}
          />
          <NotificationSection
            label="Earlier"
            items={earlierItems}
            onMarkRead={(id) => void markRead(id)}
          />
        </div>
      ) : (
        <div className="notifications-feed">
          <NotificationSection
            label="Recent"
            items={items}
            onMarkRead={(id) => void markRead(id)}
          />
        </div>
      )}
    </div>
  );
}
