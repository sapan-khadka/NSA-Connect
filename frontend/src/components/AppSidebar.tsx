import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canViewMemberDirectory,
  formatRoleLabel,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { AppLogo } from "./AppLogo";

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
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
    { label: "Discussions", to: "/discussions" },
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

  const mainItems: SidebarLink[] = [
    { to: "/", label: "Home", icon: Home, end: true },
    {
      to: "/announcements",
      label: "Announcements",
      icon: Megaphone,
    },
    {
      to: "/events/calendar",
      label: "Events",
      icon: CalendarDays,
    },
    ...(showMembers
      ? [
          {
            to: "/members",
            label: "Members",
            icon: Users,
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const toolItems: SidebarLink[] = [
    {
      to: "/assistant",
      label: "Assistant",
      icon: Sparkles,
    },
    {
      to: "/reports",
      label: "Reports",
      icon: ClipboardList,
    },
    ...(showFinance
      ? [
          {
            to: "/finance",
            label: "Finance",
            icon: Wallet,
          } satisfies SidebarLink,
        ]
      : []),
  ];

  const roleLabel = member ? formatRoleLabel(member.role) : "";
  const adminIsActivePill = adminActive && !adminOpen;

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
          <div>
            <SidebarSectionLabel>Main</SidebarSectionLabel>
            <ul className="space-y-0.5">
              {mainItems.map((item) => (
                <li key={item.to}>
                  <SidebarNavLink item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SidebarSectionLabel>Tools</SidebarSectionLabel>
            <ul className="space-y-0.5">
              {toolItems.map((item) => (
                <li key={item.to}>
                  <SidebarNavLink item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>

          {showAdmin ? (
            <div>
              <SidebarSectionLabel>Admin</SidebarSectionLabel>
              <ul className="space-y-0.5">
                <li>
                  <button
                    type="button"
                    aria-expanded={adminOpen}
                    onClick={() => setAdminOpen((current) => !current)}
                    className={[
                      navItemBaseClass,
                      adminIsActivePill ? navItemActiveClass : navItemIdleClass,
                    ].join(" ")}
                  >
                    <AppIcon
                      icon={LayoutDashboard}
                      size="md"
                      className={
                        adminIsActivePill
                          ? "text-primary"
                          : "text-label transition-colors group-hover:text-foreground"
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      Admin
                    </span>
                    <AppIcon
                      icon={ChevronDown}
                      size="xs"
                      className={[
                        "text-label transition-transform duration-200 ease-out",
                        adminOpen ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>
                  {adminOpen ? (
                    <ul className="relative mt-1 space-y-0.5 border-l border-gray-200 ml-4 pl-2">
                      {adminItems.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              [
                                "block rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                                focusRingClass,
                                isActive
                                  ? "bg-badge-teal-bg font-semibold text-primary"
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
              </ul>
            </div>
          ) : null}
        </div>
      </nav>

      <div className="shrink-0 space-y-2.5 border-t border-gray-100 px-2.5 pb-3 pt-3">
        <div className="rounded-lg border border-gray-200/80 bg-surface-muted/70 p-3">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-badge-teal-bg text-primary">
              <AppIcon icon={Sparkles} size="sm" className="text-current" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">
                Need help?
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-label">
                Ask the assistant about events, dues, and member tools.
              </p>
            </div>
          </div>
          <Link
            to="/assistant"
            onClick={onNavigate}
            className={[
              "mt-2.5 inline-flex w-full items-center justify-center gap-1 rounded-md",
              "bg-surface-card px-2.5 py-1.5 text-[12px] font-semibold text-primary",
              "ring-1 ring-inset ring-gray-200/90 transition duration-150",
              "hover:bg-badge-teal-bg hover:ring-primary/20",
              focusRingClass,
            ].join(" ")}
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
