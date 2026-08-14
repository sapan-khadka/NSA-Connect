import { Menu, Search, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { useAuth } from "../context/useAuth";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { NotificationMenu } from "../design-system/components/navigation/NotificationMenu";
import { isEventFinanceEditable } from "../lib/event-finance";
import { fetchEvents } from "../lib/events-api";
import { canManageTreasury } from "../lib/roles";
import {
  formatSemesterLabel,
  getCurrentSemesterSlug,
} from "../lib/semester";
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
 * Top header: search + Create + notifications.
 * Account menu lives in AppSidebar (bottom-left) only.
 */
export function AppTopBar({
  onOpenSidebar,
  showMenuButton = false,
}: AppTopBarProps) {
  const { member } = useAuth();
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
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
  const semesterLabel = formatSemesterLabel(getCurrentSemesterSlug());

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

        {/* Below md: icon opens GlobalSearch overlay. md+: persistent inline field. */}
        <button
          type="button"
          aria-label="Search events, members, announcements"
          onClick={openSearch}
          className="ds-icon-btn ml-auto h-10 w-10 shrink-0 rounded-xl text-label transition duration-200 hover:bg-surface-muted hover:text-foreground md:hidden"
        >
          <AppIcon icon={Search} size="md" className="text-current" />
        </button>

        <form
          onSubmit={handleSearch}
          className="relative mx-auto hidden min-w-0 w-full max-w-2xl flex-1 md:block"
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
        </form>

        <div className="ds-topbar-context hidden shrink-0 items-center gap-2 lg:flex">
          <p
            className="text-xs font-medium tabular-nums text-label"
            aria-label="Today’s date"
          >
            {todayLabel}
          </p>
          <span className="h-3 w-px bg-gray-200" aria-hidden="true" />
          <p
            className="rounded-full border border-gray-200 bg-surface-muted px-2.5 py-1 text-[11px] font-semibold tracking-wide text-foreground"
            aria-label="Current semester"
          >
            {semesterLabel}
          </p>
          <button
            type="button"
            onClick={openSearch}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[10px] font-medium text-label transition hover:border-gray-300 hover:text-foreground"
            aria-label="Open command search"
            title="Search (⌘K)"
          >
            <kbd className="font-semibold">⌘</kbd>
            <kbd className="font-semibold">K</kbd>
          </button>
        </div>

        {/* z-index only needs to beat page content for open menus — keep menus portaled-ish high without covering the page body for clicks */}
        <div className="ds-topbar-actions relative z-[45] flex shrink-0 items-center gap-1 sm:gap-2 md:ml-auto">
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
