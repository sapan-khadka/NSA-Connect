import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import type { BadgeCategory } from "../lib/badge-tones";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canViewMemberDirectory,
  formatRoleLabel,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { AppLogo } from "./AppLogo";
import { IconBadge } from "./ui/IconBadge";

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  category: BadgeCategory;
  end?: boolean;
};

type AppSidebarProps = {
  onNavigate?: () => void;
};

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SidebarAccountMenu({
  fullName,
  roleLabel,
  onLogout,
  onNavigate,
}: {
  fullName: string;
  roleLabel: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative border-t border-gray-100 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Account menu for ${fullName}`}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="ds-icon-btn h-9 w-9 shrink-0 rounded-full bg-badge-teal-bg text-xs font-semibold text-badge-teal">
          {getInitials(fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {fullName.split(/\s+/)[0] ?? fullName}
          </span>
          <span className="block truncate text-xs text-label">{roleLabel}</span>
        </span>
        <AppIcon icon={ChevronDown} size="xs" className="text-label" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-gray-100 bg-white py-1 shadow-card"
        >
          <NavLink
            to="/profile"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="block px-3 py-2.5 text-sm text-foreground hover:bg-surface-muted"
          >
            Account settings
          </NavLink>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-muted"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarNavLink({
  item,
  onNavigate,
}: {
  item: SidebarLink;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        ["ds-sidebar-link", isActive ? "ds-sidebar-link--active" : ""].join(" ")
      }
    >
      {() => (
        <>
          <IconBadge
            icon={item.icon}
            category={item.category}
            size="sm"
            shape="rounded"
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { member } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const showMembers = member ? canBrowseMemberDirectory(member.role) : false;
  const showFinance = member ? canAccessFinance(member.role) : false;
  const showAdmin = member ? canViewMemberDirectory(member.role) : false;

  const adminItems = [
    { label: "Board discussion", to: "/board/discussion" },
    { label: "Meeting minutes", to: "/board/meeting-minutes" },
    { label: "Announcement email", to: "/board/announcement-email" },
  ];

  const adminActive = adminItems.some((item) =>
    location.pathname.startsWith(item.to.split("?")[0] ?? item.to),
  );
  const [adminOpen, setAdminOpen] = useState(adminActive);

  useEffect(() => {
    if (adminActive) {
      setAdminOpen(true);
    }
  }, [adminActive]);

  const primaryItems: SidebarLink[] = [
    { to: "/", label: "Home", icon: Home, category: "home", end: true },
    {
      to: "/announcements",
      label: "Announcements",
      icon: Megaphone,
      category: "announcements",
    },
    {
      to: "/events/calendar",
      label: "Events",
      icon: CalendarDays,
      category: "events",
    },
    ...(showMembers
      ? [
          {
            to: "/members",
            label: "Members",
            icon: Users,
            category: "members",
          } satisfies SidebarLink,
        ]
      : []),
    {
      to: "/assistant",
      label: "Assistant",
      icon: Sparkles,
      category: "assistant",
    },
    {
      to: "/reports",
      label: "Reports",
      icon: ClipboardList,
      category: "reports",
    },
    ...(showFinance
      ? [
          {
            to: "/finance",
            label: "Finance",
            icon: Wallet,
            category: "finance",
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const roleLabel = member ? formatRoleLabel(member.role) : "";
  const adminIsActivePill = adminActive && !adminOpen;

  return (
    <aside className="ds-sidebar">
      <div className="px-4 pb-3 pt-5">
        <AppLogo asLink size="nav" showTagline={false} />
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1.5">
          {primaryItems.map((item) => (
            <li key={item.to}>
              <SidebarNavLink item={item} onNavigate={onNavigate} />
            </li>
          ))}

          {showAdmin ? (
            <li>
              <button
                type="button"
                aria-expanded={adminOpen}
                onClick={() => setAdminOpen((current) => !current)}
                className={[
                  "ds-sidebar-link",
                  adminIsActivePill ? "ds-sidebar-link--active" : "",
                ].join(" ")}
              >
                <IconBadge
                  icon={LayoutDashboard}
                  category="admin"
                  size="sm"
                  shape="rounded"
                />
                <span className="flex-1 text-left">Admin</span>
                <AppIcon
                  icon={ChevronDown}
                  size="xs"
                  className={[
                    "transition-transform duration-200",
                    adminOpen ? "rotate-180" : "",
                    "text-label",
                  ].join(" ")}
                />
              </button>
              {adminOpen ? (
                <ul className="mt-1.5 space-y-0.5 border-l border-gray-200 ml-5 pl-2">
                  {adminItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          [
                            "block rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-label hover:bg-surface-muted hover:text-foreground",
                          ].join(" ")
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ) : null}
        </ul>
      </nav>

      <div className="space-y-3 px-3 pb-4 pt-2">
        <div className="ds-help-card">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={Sparkles} category="assistant" size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Need help?</p>
              <p className="mt-0.5 text-xs leading-snug text-label">
                Ask the assistant about events, dues, and member tools.
              </p>
            </div>
          </div>
          <Link
            to="/assistant"
            onClick={onNavigate}
            className="mt-3 ds-icon-label inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-white"
          >
            Ask Assistant
            <AppIcon icon={ChevronRight} size="xs" className="text-current" />
          </Link>
        </div>

        {member ? (
          <SidebarAccountMenu
            fullName={member.full_name}
            roleLabel={roleLabel}
            onLogout={logout}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
    </aside>
  );
}
