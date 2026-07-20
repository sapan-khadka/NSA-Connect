import { Menu, Search, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { NotificationMenu } from "../design-system/components/navigation/NotificationMenu";
import { isEventFinanceEditable } from "../lib/event-finance";
import { fetchEvents } from "../lib/events-api";
import { canManageTreasury } from "../lib/roles";
import { AccountMenu } from "./AppNav";
import { CreateMenu } from "./CreateMenu";
import { GlobalSearch } from "./GlobalSearch";
import { LogFinanceEntryForm } from "./LogFinanceEntryForm";
import { AppIcon } from "./ui/AppIcon";
import { Modal } from "./ui/Modal";

type AppTopBarProps = {
  onOpenSidebar?: () => void;
  showMenuButton?: boolean;
};

/**
 * Top header: search + Create + notifications + avatar.
 * Primary navigation lives in AppSidebar — not here.
 */
export function AppTopBar({
  onOpenSidebar,
  showMenuButton = false,
}: AppTopBarProps) {
  const { member } = useAuth();
  const logout = useLogout();
  const { menuItems, unreadCount, markRead, markAllRead } =
    useNotificationSummary();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [eventOptions, setEventOptions] = useState<
    Array<{ id: number; name: string }>
  >([]);
  /** Blocks header-input onFocus from reopening search after close focus restore. */
  const suppressSearchOpenRef = useRef(false);

  const canLog =
    member != null && canManageTreasury(member.role, member.position);

  useEffect(() => {
    if (!canLog || !isLogOpen) {
      return;
    }

    let cancelled = false;

    void fetchEvents()
      .then((response) => {
        if (!cancelled) {
          setEventOptions(
            response.events
              .filter((event) => isEventFinanceEditable(event))
              .map((event) => ({ id: event.id, name: event.name })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEventOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canLog, isLogOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function openSearch() {
    if (suppressSearchOpenRef.current) {
      return;
    }
    setSearchOpen(true);
  }

  function closeSearch() {
    // Focus trap restores focus to the header field on unmount; that would
    // fire onFocus → openSearch and bounce the dialog back open.
    suppressSearchOpenRef.current = true;
    setSearchOpen(false);
    window.setTimeout(() => {
      suppressSearchOpenRef.current = false;
    }, 0);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    openSearch();
  }

  return (
    <>
      <header className="ds-topbar">
        {showMenuButton ? (
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onOpenSidebar}
            className="ds-icon-btn h-10 w-10 shrink-0 rounded-xl text-label transition duration-200 hover:bg-surface-muted hover:text-foreground lg:hidden"
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
            onFocus={openSearch}
            onClick={openSearch}
            placeholder="Search events, members, announcements…"
            aria-label="Search events, members, announcements"
            className="ds-topbar-search"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-label sm:inline">
            ⌘ K
          </kbd>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <CreateMenu
            onLogTransaction={canLog ? () => setIsLogOpen(true) : undefined}
          />

          <NotificationMenu
            items={menuItems}
            unreadCount={unreadCount}
            emptyMessage="You're all caught up. New tasks, budget updates, and announcements will show up here."
            viewAllTo="/notifications"
            viewAllLabel="View all notifications"
            onMarkAllRead={() => {
              void markAllRead();
            }}
            onItemSelect={(item) => {
              const id = Number(item.id);
              if (Number.isFinite(id) && item.unread) {
                void markRead(id);
              }
            }}
          />

          {member ? (
            <AccountMenu
              fullName={member.full_name}
              onLogout={logout}
              avatarOnly
            />
          ) : null}
        </div>
      </header>

      <GlobalSearch
        open={searchOpen}
        onClose={closeSearch}
        initialQuery={query}
      />

      <Modal
        open={isLogOpen}
        title="Log transaction"
        onClose={() => setIsLogOpen(false)}
      >
        <LogFinanceEntryForm
          idPrefix="header-log-transaction"
          eventOptions={eventOptions}
          onCreated={() => setIsLogOpen(false)}
        />
      </Modal>
    </>
  );
}

type MobileSidebarDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Tablet/mobile collapsible sidebar drawer with backdrop + slide transition.
 */
export function MobileSidebarDrawer({
  open,
  onClose,
  children,
}: MobileSidebarDrawerProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setRendered(false), 280);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!rendered) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={!visible}>
      <button
        type="button"
        aria-label="Close navigation"
        className={[
          "absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />
      <div
        className={[
          "absolute inset-y-0 left-0 flex w-[min(100%,var(--sidebar-width))] flex-col bg-white shadow-card transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ds-icon-btn h-9 w-9 rounded-xl text-label transition duration-200 hover:bg-surface-muted"
          >
            <AppIcon icon={X} size="sm" className="text-current" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
