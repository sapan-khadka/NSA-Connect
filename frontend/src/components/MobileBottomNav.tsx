import { CalendarDays, Home, Megaphone, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { useIsLgUp } from "../hooks/useMediaQuery";
import { canBrowseMemberDirectory } from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";

type TabItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export function MobileBottomNav() {
  const { isAuthenticated, member } = useAuth();
  const isLgUp = useIsLgUp();

  if (!isAuthenticated || !member || isLgUp) {
    return null;
  }

  const tabs: TabItem[] = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/events/calendar", label: "Events", icon: CalendarDays },
    ...(canBrowseMemberDirectory(member.role)
      ? [{ to: "/members", label: "Members", icon: Users } as TabItem]
      : []),
    { to: "/announcements", label: "News", icon: Megaphone },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-label hover:text-foreground",
                ].join(" ")
              }
            >
              <AppIcon icon={tab.icon} size="md" className="text-current" />
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
