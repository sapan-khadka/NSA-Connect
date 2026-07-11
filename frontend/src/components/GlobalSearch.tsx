import {
  CalendarDays,
  Clock3,
  FileText,
  Megaphone,
  Search as SearchIcon,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { Search } from "../design-system/components/Search";
import { EmptyState } from "../design-system/components/data-display/EmptyState";
import { Spinner } from "../design-system/components/Spinner";
import {
  useBodyScrollLock,
  useEscapeKey,
  useFocusTrap,
} from "../design-system/components/feedback/useOverlay";
import { navFocusRingClass } from "../design-system/components/navigation/navStyles";
import { useAuth } from "../context/useAuth";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import {
  globalSearchCategoryLabel,
  type GlobalSearchCategory,
  type GlobalSearchResult,
} from "../lib/global-search";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";

type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
  /** Optional seed query when opening from the header field. */
  initialQuery?: string;
};

const CATEGORY_ICON: Record<GlobalSearchCategory, typeof Users> = {
  member: Users,
  event: CalendarDays,
  announcement: Megaphone,
  transaction: Wallet,
};

function ResultRow({
  result,
  active,
  onSelect,
  id,
}: {
  result: GlobalSearchResult;
  active: boolean;
  onSelect: () => void;
  id: string;
}) {
  const Icon = CATEGORY_ICON[result.category];

  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={[
        "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition duration-150",
        "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
        active ? "bg-badge-teal-bg text-primary" : "hover:bg-surface-muted",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-white text-primary" : "bg-surface-muted text-label",
        ].join(" ")}
        aria-hidden="true"
      >
        <AppIcon icon={Icon} size="sm" className="text-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {result.title}
        </span>
        {result.subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-label">
            {result.subtitle}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-label">
        {globalSearchCategoryLabel(result.category)}
      </span>
    </button>
  );
}

/**
 * Professional global search dialog (⌘K).
 * Searches members, events, announcements, and transactions via existing list APIs.
 */
export function GlobalSearch({
  open,
  onClose,
  initialQuery = "",
}: GlobalSearchProps) {
  const { member } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(0);

  const includeMembers = member ? canBrowseMemberDirectory(member.role) : false;
  const includeFinance = member ? canAccessFinance(member.role) : false;

  const {
    query,
    setQuery,
    debouncedQuery,
    results,
    grouped,
    loading,
    error,
    recent,
    remember,
    clearRecent,
    resetQuery,
  } = useGlobalSearch({
    open,
    includeFinance,
    includeMembers,
  });

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(open, dialogRef, { initialFocus: false });

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery(initialQuery);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialQuery, setQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, results.length]);

  function closeAndReset() {
    resetQuery();
    onClose();
  }

  function selectResult(result: GlobalSearchResult) {
    remember(query || result.title);
    closeAndReset();
    navigate(result.to);
  }

  function selectRecent(value: string) {
    setQuery(value);
    remember(value);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length === 0 ? 0 : Math.min(current + 1, results.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      const selected = results[activeIndex];
      if (selected) {
        event.preventDefault();
        selectResult(selected);
      } else if (query.trim()) {
        event.preventDefault();
        remember(query);
        closeAndReset();
        navigate(`/events/calendar?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  if (!open) {
    return null;
  }

  const showRecent = !debouncedQuery && recent.length > 0;
  const showEmpty =
    !loading && Boolean(debouncedQuery) && results.length === 0 && !error;
  const showIdle =
    !loading && !debouncedQuery && recent.length === 0 && !error;

  let body: ReactNode;

  if (loading && !debouncedQuery) {
    body = (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <Spinner size="lg" label="Loading search" />
        <p className="text-sm text-label">Loading searchable data…</p>
      </div>
    );
  } else if (error && results.length === 0) {
    body = (
      <EmptyState
        icon={<AppIcon icon={SearchIcon} size="sm" className="text-current" />}
        title="Search unavailable"
        description={error}
      />
    );
  } else if (showIdle) {
    body = (
      <EmptyState
        icon={<AppIcon icon={SearchIcon} size="sm" className="text-current" />}
        title="Search NSA Connect"
        description="Find members, events, announcements, and transactions."
      />
    );
  } else if (showRecent) {
    body = (
      <div className="space-y-2 px-2 py-2">
        <div className="flex items-center justify-between px-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-label">
            Recent searches
          </p>
          <button
            type="button"
            onClick={clearRecent}
            className="text-xs font-medium text-label transition hover:text-foreground"
          >
            Clear
          </button>
        </div>
        <ul className="space-y-0.5" role="list">
          {recent.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => selectRecent(item)}
                className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left text-sm transition hover:bg-surface-muted"
              >
                <AppIcon icon={Clock3} size="sm" className="text-label" />
                <span className="truncate text-foreground">{item}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (showEmpty) {
    body = (
      <EmptyState
        icon={<AppIcon icon={FileText} size="sm" className="text-current" />}
        title={`No results for “${debouncedQuery}”`}
        description="Try a different name, title, or keyword."
      />
    );
  } else {
    body = (
      <div
        id={listId}
        role="listbox"
        aria-label="Search results"
        className="space-y-4 px-2 py-2"
      >
        {grouped.map((group) => (
          <section key={group.category} className="space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-label">
              {globalSearchCategoryLabel(group.category)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((result) => {
                const flatIndex = results.findIndex(
                  (item) => item.id === result.id,
                );
                return (
                  <ResultRow
                    key={result.id}
                    id={`${listId}-${result.id}`}
                    result={result}
                    active={flatIndex === activeIndex}
                    onSelect={() => selectResult(result)}
                  />
                );
              })}
            </div>
          </section>
        ))}
        {loading ? (
          <p className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-label">
            <Spinner size="sm" label="Updating results" />
            Updating…
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[min(20vh,8rem)] sm:px-6"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-label="Close search"
        className="ds-animate-fade-in absolute inset-0 bg-black/40"
        onClick={closeAndReset}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="ds-animate-slide-up relative z-10 flex max-h-[min(70vh,36rem)] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-gray-200 bg-surface-card shadow-card-hover"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-3">
          <Search
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            clearable
            loading={loading && Boolean(debouncedQuery)}
            placeholder="Search members, events, announcements, transactions…"
            aria-label="Global search"
            aria-controls={listId}
            aria-autocomplete="list"
            inputClassName="h-11 rounded-xl border-transparent bg-transparent py-2 shadow-none focus:border-transparent focus:ring-0"
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={closeAndReset}
            className={[
              "ds-icon-btn h-10 w-10 shrink-0 rounded-xl text-label transition hover:bg-surface-muted hover:text-foreground",
              navFocusRingClass,
            ].join(" ")}
          >
            <AppIcon icon={X} size="md" className="text-current" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-[11px] text-label">
          <span>
            <kbd className="rounded border border-gray-200 bg-surface px-1.5 py-0.5 font-medium">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-gray-200 bg-surface px-1.5 py-0.5 font-medium">
              Enter
            </kbd>{" "}
            open
          </span>
          <span>
            <kbd className="rounded border border-gray-200 bg-surface px-1.5 py-0.5 font-medium">
              Esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
