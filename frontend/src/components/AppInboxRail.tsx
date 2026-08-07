import { Link } from "react-router";
import { ArrowUpRight, MessageSquare, PanelRightClose } from "lucide-react";

import { useAuth } from "../context/useAuth";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { useInboxRailPrefs } from "../lib/inbox-rail-prefs";
import { HomeDiscussionSection } from "./HomeDiscussionSection";
import { AppIcon } from "./ui/AppIcon";

/**
 * Fixed desktop Inbox column — permanent right communication zone.
 * Collapses to a compact control; not a Home canvas widget.
 */
export function AppInboxRail() {
  const { member } = useAuth();
  const { summary } = useNotificationSummary();
  const { prefs, setPrefs } = useInboxRailPrefs(member?.id);
  const unread = summary.discussions_unread;

  if (prefs.collapsed || !prefs.open) {
    return (
      <aside
        className="app-inbox-pane app-inbox-pane--collapsed"
        aria-label="Inbox"
      >
        <button
          type="button"
          className="app-inbox-pane__bubble"
          title="Expand inbox"
          aria-label="Expand inbox"
          onClick={() =>
            setPrefs((current) => ({
              ...current,
              open: true,
              collapsed: false,
            }))
          }
        >
          <AppIcon icon={MessageSquare} size="sm" />
          {unread > 0 ? (
            <span className="app-inbox-pane__bubble-badge">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className="app-inbox-pane" aria-label="Inbox">
      <div className="app-inbox-pane__inner">
        <header className="app-inbox-pane__chrome">
          <div className="app-inbox-pane__heading">
            <h2 className="app-inbox-pane__title">Inbox</h2>
            {unread > 0 ? (
              <span
                className="app-inbox-pane__count"
                aria-label={`${unread} unread`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </div>
          <div className="app-inbox-pane__chrome-actions">
            <Link to="/discussions" className="app-inbox-pane__open">
              Open
              <AppIcon icon={ArrowUpRight} size="xs" />
            </Link>
            <button
              type="button"
              className="app-inbox-pane__icon-btn"
              title="Collapse inbox"
              aria-label="Collapse inbox"
              onClick={() =>
                setPrefs((current) => ({ ...current, collapsed: true }))
              }
            >
              <AppIcon icon={PanelRightClose} size="sm" />
            </button>
          </div>
        </header>
        <div className="app-inbox-pane__body">
          <HomeDiscussionSection previewLimit={14} variant="rail" />
        </div>
      </div>
    </aside>
  );
}
