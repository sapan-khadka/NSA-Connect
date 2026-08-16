import {
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
 * Mobile bottom chrome: Home · Events · Inbox · Settings.
 */
export function MobileBottomNav() {
  const { isAuthenticated, member } = useAuth();
  const isLgUp = useIsLgUp();
  const { summary } = useNotificationSummary();

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
    { to: "/settings", label: "Settings", icon: UserRound },
  ];

  return (
    <nav aria-label="Mobile navigation" className="ds-mobile-bottom-nav">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              aria-label={tab.label}
              className={({ isActive }) =>
                [
                  "relative flex min-h-12 items-center justify-center rounded-xl text-current",
                  isActive
                    ? "text-foreground"
                    : "text-label hover:text-foreground",
                ].join(" ")
              }
            >
              <span className="relative inline-flex">
                <AppIcon icon={tab.icon} size="md" className="text-current" />
                {(tab.badgeCount ?? 0) > 0 ? (
                  <NavCountBadge
                    count={tab.badgeCount ?? 0}
                    className="absolute -right-2.5 -top-1.5 h-4 min-w-4 px-1 text-[9px]"
                  />
                ) : null}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
