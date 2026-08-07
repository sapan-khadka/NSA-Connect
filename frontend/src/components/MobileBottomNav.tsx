import {
  Bell,
  CalendarDays,
  Home,
  MessageSquare,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

import {
  NavCountBadge,
  useNotificationSummary,
} from "../context/NotificationSummaryProvider";
import { useAuth } from "../context/useAuth";
import { useIsLgUp } from "../hooks/useMediaQuery";
import { AppIcon } from "./ui/AppIcon";

type TabItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeCount?: number;
};

/**
 * Mobile bottom chrome: Home · Events · Inbox · Notifications · Profile.
 * Inbox is a primary destination (full-screen /discussions), not a Home widget.
 */
export function MobileBottomNav() {
  const { isAuthenticated, member } = useAuth();
  const isLgUp = useIsLgUp();
  const { summary, unreadCount } = useNotificationSummary();

  if (!isAuthenticated || !member || isLgUp) {
    return null;
  }

  const eventsBadge =
    summary.suggestions_pending +
    summary.tasks_overdue +
    summary.tasks_due_today +
    summary.tasks_oversight_overdue;

  const tabs: TabItem[] = [
    { to: "/", label: "Home", icon: Home, end: true },
    {
      to: "/events/calendar",
      label: "Events",
      icon: CalendarDays,
      badgeCount: eventsBadge,
    },
    {
      to: "/discussions",
      label: "Inbox",
      icon: MessageSquare,
      badgeCount: summary.discussions_unread,
    },
    {
      to: "/notifications",
      label: "Alerts",
      icon: Bell,
      badgeCount: unreadCount,
    },
    { to: "/profile", label: "Profile", icon: UserRound },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-0.5">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  "relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[10px] font-semibold transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-label hover:text-foreground",
                ].join(" ")
              }
            >
              <span className="relative inline-flex">
                <AppIcon icon={tab.icon} size="md" className="text-current" />
                {(tab.badgeCount ?? 0) > 0 ? (
                  <NavCountBadge
                    count={tab.badgeCount ?? 0}
                    className="absolute -right-3 -top-1.5 h-4 min-w-4 px-1 text-[9px]"
                  />
                ) : null}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
