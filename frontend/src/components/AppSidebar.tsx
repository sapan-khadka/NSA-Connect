import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Home,
  LogOut,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { NavLink } from "react-router";

import {
  NavCountBadge,
  useNotificationSummary,
} from "../context/NotificationSummaryProvider";
import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import { avatarColorForPerson } from "../lib/avatar-color";
import {
  canBrowseMemberDirectory,
  formatMemberAccessLabel,
  memberSatisfiesMinRole,
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
  "outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card";

const navItemBaseClass = [
  "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] font-medium tracking-body",
  "transition-[background-color,color] duration-150 ease-out",
  focusRingClass,
].join(" ");

const navItemIdleClass = "app-nav-item--idle";

const navItemActiveClass = "app-nav-item--active";

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
  memberId,
  fullName,
  avatarUrl = null,
  roleLabel,
  onLogout,
  onNavigate,
}: {
  memberId?: number | null;
  fullName: string;
  avatarUrl?: string | null;
  roleLabel: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const palette = avatarColorForPerson(memberId, fullName);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imageFailed;

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
          "transition-colors duration-150 hover:bg-[#ebebea]",
          focusRingClass,
          open ? "bg-[#ebebea]" : "",
        ].join(" ")}
      >
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold"
          style={
            showImage
              ? undefined
              : {
                  backgroundColor: palette.background,
                  color: palette.color,
                }
          }
        >
          {showImage ? (
            <img
              src={avatarUrl ?? undefined}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            getInitials(fullName)
          )}
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
            to="/settings"
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
            Settings
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
      style={({ isActive }) =>
        isActive ? { backgroundColor: "#f4f4f5", color: "#111111" } : undefined
      }
    >
      {({ isActive }) => (
        <>
          <AppIcon
            icon={item.icon}
            size="md"
            className={
              isActive
                ? "text-current"
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
  const showBoardSurfaces = member
    ? memberSatisfiesMinRole(member, "board")
    : false;

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
    {
      to: "/assistant",
      label: "AI & Documents",
      icon: Sparkles,
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
    ...(showBoardSurfaces
      ? [
          {
            to: "/events/meetings",
            label: "Meetings",
            icon: NotebookPen,
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const financeItems: SidebarLink[] = [
    ...(showBoardSurfaces
      ? [
          {
            to: "/finance",
            label: "Treasury",
            icon: Wallet,
            badgeCount: summary.finance_pending,
          } satisfies SidebarLink,
        ]
      : []),
    ...(showBoardSurfaces
      ? [
          {
            to: "/reports",
            label: "Reports",
            icon: ClipboardList,
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const adminItems: SidebarLink[] = [
    {
      to: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const roleLabel = member ? formatMemberAccessLabel(member) : "";

  return (
    <aside className="ds-sidebar">
      <div className="ds-sidebar__brand shrink-0 border-b px-4 pb-4 pt-5">
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

      {member ? (
        <div className="shrink-0 border-t border-[#ebebea] px-2.5 pb-3 pt-3">
          <SidebarAccountMenu
            memberId={member.id}
            fullName={member.full_name}
            avatarUrl={member.avatar_url}
            roleLabel={roleLabel}
            onLogout={logout}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}
    </aside>
  );
}
