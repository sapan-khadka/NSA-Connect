import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";

import {
  NavCountBadge,
  useNotificationSummary,
} from "../context/NotificationSummaryProvider";
import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canViewMemberDirectory,
  formatRoleLabel,
  isRoleAtLeast,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { AppLogo } from "./AppLogo";

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeCount?: number;
};

type AppSidebarProps = {
  onNavigate?: () => void;
};

const focusRingClass =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card";

const navItemBaseClass = [
  "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium tracking-body",
  "transition-[background-color,color,box-shadow] duration-150 ease-out",
  focusRingClass,
].join(" ");

const navItemIdleClass =
  "text-label hover:bg-surface-muted hover:text-foreground";

const navItemActiveClass =
  "bg-badge-teal-bg font-semibold text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-primary";

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SidebarSectionLabel({ children }: { children: string }) {
  return (
    <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-label/80">
      {children}
    </p>
  );
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Account menu for ${fullName}`}
        onClick={() => setOpen((current) => !current)}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left",
          "transition-colors duration-150 hover:bg-surface-muted",
          focusRingClass,
          open ? "bg-surface-muted" : "",
        ].join(" ")}
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-badge-teal-bg text-[11px] font-semibold text-badge-teal ring-1 ring-inset ring-primary/10">
          {getInitials(fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {fullName.split(/\s+/)[0] ?? fullName}
          </span>
          <span className="block truncate text-[11px] text-label">
            {roleLabel}
          </span>
        </span>
        <AppIcon
          icon={ChevronDown}
          size="xs"
          className={[
            "text-label transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-full overflow-hidden rounded-lg border border-gray-200 bg-surface-card py-1 shadow-card"
        >
          <NavLink
            to="/profile"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className={[
              "flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-foreground",
              "transition-colors hover:bg-surface-muted",
              focusRingClass,
            ].join(" ")}
          >
            <AppIcon icon={Settings} size="sm" className="text-label" />
            Account settings
          </NavLink>
          <div className="my-1 border-t border-gray-100" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className={[
              "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-overdue",
              "transition-colors hover:bg-overdue-surface",
              focusRingClass,
            ].join(" ")}
          >
            <AppIcon icon={LogOut} size="sm" className="text-overdue" />
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
        [navItemBaseClass, isActive ? navItemActiveClass : navItemIdleClass].join(
          " ",
        )
      }
    >
      {({ isActive }) => (
        <>
          <AppIcon
            icon={item.icon}
            size="md"
            className={
              isActive
                ? "text-primary"
                : "text-label transition-colors group-hover:text-foreground"
            }
          />
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          <NavCountBadge count={item.badgeCount ?? 0} />
        </>
      )}
    </NavLink>
  );
}

function SidebarNavSection({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: SidebarLink[];
  onNavigate?: () => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <SidebarSectionLabel>{label}</SidebarSectionLabel>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={`${item.to}-${item.label}`}>
            <SidebarNavLink item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { member } = useAuth();
  const logout = useLogout();
  const { summary } = useNotificationSummary();
  const showMembers = member ? canBrowseMemberDirectory(member.role) : false;
  const showFinance = member ? canAccessFinance(member.role) : false;
  const showBoardWork = member ? isRoleAtLeast(member.role, "board") : false;
  const showAdmin = member ? canViewMemberDirectory(member.role) : false;

  const myTasksCount = summary.tasks_overdue + summary.tasks_due_today;
  const eventsBadge =
    myTasksCount +
    summary.suggestions_pending +
    summary.tasks_oversight_overdue;

  const mainItems: SidebarLink[] = [
    { to: "/", label: "Home", icon: Home, end: true },
    {
      to: "/events/calendar",
      label: "Events",
      icon: CalendarDays,
      badgeCount: eventsBadge,
    },
    ...(showMembers
      ? [
          {
            to: "/members",
            label: "Members",
            icon: Users,
            badgeCount: summary.members_pending,
          } satisfies SidebarLink,
        ]
      : []),
    {
      to: "/announcements",
      label: "Announcements",
      icon: Megaphone,
    },
  ];

  const workItems: SidebarLink[] = [
    {
      to: "/events/tasks",
      label: "Tasks",
      icon: ClipboardList,
      badgeCount: myTasksCount,
    },
    {
      to: "/discussions",
      label: "Discussions",
      icon: MessageSquare,
      badgeCount: summary.discussions_unread,
    },
    ...(showBoardWork
      ? [
          {
            to: "/board/meeting-minutes",
            label: "Documents",
            icon: FileText,
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const financeItems: SidebarLink[] = [
    ...(showFinance
      ? [
          {
            to: "/finance",
            label: "Treasury",
            icon: Wallet,
            badgeCount: summary.finance_pending,
          } satisfies SidebarLink,
        ]
      : []),
    {
      to: "/reports",
      label: "Reports",
      icon: ClipboardList,
    },
  ];

  const adminItems: SidebarLink[] = [
    {
      to: "/profile",
      label: "Settings",
      icon: Settings,
    },
    ...(showAdmin
      ? [
          {
            to: "/members?tab=pending",
            label: "Roles & Permissions",
            icon: Shield,
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const roleLabel = member ? formatRoleLabel(member.role) : "";

  return (
    <aside className="ds-sidebar">
      <div className="shrink-0 border-b border-gray-100 px-4 pb-4 pt-5">
        <AppLogo asLink size="nav" showTagline={false} />
      </div>

      <nav
        aria-label="Primary"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-3"
      >
        <div className="space-y-4">
          <SidebarNavSection
            label="Main"
            items={mainItems}
            onNavigate={onNavigate}
          />
          <SidebarNavSection
            label="Work"
            items={workItems}
            onNavigate={onNavigate}
          />
          <SidebarNavSection
            label="Finance"
            items={financeItems}
            onNavigate={onNavigate}
          />
          <SidebarNavSection
            label="Admin"
            items={adminItems}
            onNavigate={onNavigate}
          />
        </div>
      </nav>

      <div className="shrink-0 space-y-2.5 border-t border-gray-100 px-2.5 pb-3 pt-3">
        <Link
          to="/assistant"
          onClick={onNavigate}
          className={[
            "inline-flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2",
            "text-[13px] font-medium text-label transition duration-150",
            "hover:bg-surface-muted hover:text-foreground",
            focusRingClass,
          ].join(" ")}
        >
          <span className="inline-flex items-center gap-2">
            <AppIcon icon={Sparkles} size="sm" className="text-primary" />
            Need help?
          </span>
          <AppIcon icon={ChevronRight} size="xs" className="text-current" />
        </Link>

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
