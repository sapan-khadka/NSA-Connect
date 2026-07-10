import { Bell, Menu, Search, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import { AppIcon } from "./ui/AppIcon";
import { AccountMenu } from "./AppNav";

type AppTopBarProps = {
  onOpenSidebar?: () => void;
  showMenuButton?: boolean;
};

/**
 * Top header only: search + notifications + avatar.
 * Primary navigation lives in AppSidebar — not here.
 */
export function AppTopBar({
  onOpenSidebar,
  showMenuButton = false,
}: AppTopBarProps) {
  const { member } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    navigate(`/events/calendar?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="ds-topbar">
      {showMenuButton ? (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenSidebar}
          className="ds-icon-btn h-10 w-10 shrink-0 rounded-xl text-label hover:bg-surface-muted hover:text-foreground lg:hidden"
        >
          <AppIcon icon={Menu} size="md" className="text-current" />
        </button>
      ) : (
        <span className="hidden w-10 shrink-0 lg:block" aria-hidden="true" />
      )}

      <form
        onSubmit={handleSearch}
        className="relative mx-auto min-w-0 w-full max-w-2xl flex-1"
        role="search"
      >
        <AppIcon
          icon={Search}
          size="sm"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-label"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search events, members, announcements…"
          aria-label="Search"
          className="ds-topbar-search"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-label sm:inline">
          ⌘ K
        </kbd>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Link
          to="/announcements"
          aria-label="Notifications"
          className="relative ds-icon-btn h-10 w-10 rounded-xl text-label hover:bg-surface-muted hover:text-foreground"
        >
          <AppIcon icon={Bell} size="sm" className="text-current" />
        </Link>

        {member ? (
          <AccountMenu
            fullName={member.full_name}
            onLogout={logout}
            avatarOnly
          />
        ) : null}
      </div>
    </header>
  );
}

type MobileSidebarDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function MobileSidebarDrawer({
  open,
  onClose,
  children,
}: MobileSidebarDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(100%,var(--sidebar-width))] flex-col bg-white shadow-card">
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ds-icon-btn h-9 w-9 rounded-xl text-label hover:bg-surface-muted"
          >
            <AppIcon icon={X} size="sm" className="text-current" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
