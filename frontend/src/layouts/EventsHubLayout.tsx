import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router";

import { AppIcon } from "../components/ui/AppIcon";
import {
  NavCountBadge,
  useNotificationSummary,
} from "../context/NotificationSummaryProvider";
import { useAuth } from "../context/useAuth";
import {
  memberSatisfiesMinRole,
  canViewTaskOversight,
} from "../lib/roles";

type EventsTab = {
  label: string;
  to: string;
  end?: boolean;
  badgeCount?: number;
};

type EventsTabPlan = {
  primary: EventsTab[];
  more: EventsTab[];
};

function buildEventsTabs(
  member: NonNullable<ReturnType<typeof useAuth>["member"]>,
  counts: {
    myTasks: number;
    suggestions: number;
    oversight: number;
  },
): EventsTabPlan {
  const primary: EventsTab[] = [
    { label: "Calendar", to: "/events/calendar" },
    {
      label: "Tasks",
      to: "/events/tasks",
      badgeCount: counts.myTasks,
    },
  ];

  const more: EventsTab[] = [];

  if (memberSatisfiesMinRole(member, "board")) {
    primary.push({ label: "Meetings", to: "/events/meetings" });
  }

  if (canViewTaskOversight(member.role, member.position)) {
    primary.push({
      label: "Oversight",
      to: "/events/oversight",
      badgeCount: counts.oversight,
    });
  }

  primary.push({ label: "Media", to: "/events/media" });

  // Keep Ideas last among primary tabs.
  primary.push({
    label: "Ideas",
    to: "/events/ideas",
    badgeCount: counts.suggestions,
  });

  if (memberSatisfiesMinRole(member, "board")) {
    more.push({ label: "Past events", to: "/events/past" });
  }

  return { primary, more };
}

function isTabActive(pathname: string, tab: EventsTab): boolean {
  if (tab.end) {
    return pathname === tab.to;
  }
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

function EventsMoreMenu({ items }: { items: EventsTab[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const activeItem = items.find((item) => isTabActive(location.pathname, item));
  const moreBadge = items.reduce((sum, item) => sum + (item.badgeCount ?? 0), 0);
  const isActive = Boolean(activeItem);

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

  if (items.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="More events sections"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setOpen((current) => !current)}
        className={[
          "events-hub-tab inline-flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors",
          isActive
            ? "border-primary text-foreground"
            : "border-transparent text-label hover:text-foreground",
        ].join(" ")}
      >
        <span>{activeItem ? activeItem.label : "More"}</span>
        <AppIcon icon={ChevronDown} size="xs" className="text-current opacity-70" />
        <NavCountBadge
          count={moreBadge}
          className="events-hub-tab-badge h-4 min-w-4 px-1 text-[10px]"
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="More events sections"
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-md"
        >
          {items.map((item) => {
            const active = isTabActive(location.pathname, item);
            return (
              <button
                key={item.to}
                type="button"
                role="menuitem"
                aria-current={active ? "page" : undefined}
                className={[
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors",
                  active
                    ? "bg-brand-soft font-medium text-foreground"
                    : "text-foreground hover:bg-surface-muted",
                ].join(" ")}
                onClick={() => {
                  setOpen(false);
                  navigate(item.to);
                }}
              >
                <span>{item.label}</span>
                <NavCountBadge
                  count={item.badgeCount ?? 0}
                  className="h-4 min-w-4 px-1 text-[10px]"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Underline tab row with horizontal scroll + edge fades when more tabs exist.
 * Keeps the existing tab language (vs converting to pills).
 */
function EventsHubTabBar({
  primary,
  more,
}: {
  primary: EventsTab[];
  more: EventsTab[];
}) {
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const hasOverflow = maxScroll > 2;
    setCanScrollLeft(hasOverflow && el.scrollLeft > 2);
    setCanScrollRight(hasOverflow && el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }

    updateOverflow();
    el.addEventListener("scroll", updateOverflow, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateOverflow);
      observer.observe(el);
    } else {
      window.addEventListener("resize", updateOverflow);
    }

    return () => {
      el.removeEventListener("scroll", updateOverflow);
      observer?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [primary, more, updateOverflow]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const active = el.querySelector<HTMLElement>("[aria-current='page']");
    if (active && typeof active.scrollIntoView === "function") {
      try {
        active.scrollIntoView({
          inline: "nearest",
          block: "nearest",
          behavior: "auto",
        });
      } catch {
        // jsdom may not implement scrollIntoView options
      }
    }
    updateOverflow();
  }, [location.pathname, primary, more, updateOverflow]);

  return (
    <nav
      aria-label="Events sections"
      className={[
        "events-hub-tabs sticky top-0 z-20 border-b border-gray-200 bg-surface/95 px-3 pb-0 backdrop-blur-sm sm:-mx-1 sm:border-surface-card sm:px-1",
        canScrollLeft ? "events-hub-tabs--fade-left" : "",
        canScrollRight ? "events-hub-tabs--fade-right" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Keep More outside the overflow scroller so its dropdown isn't clipped. */}
      <div className="events-hub-tabs-row">
        <div className="events-hub-tabs-scroll-wrap">
          <div ref={scrollerRef} className="events-hub-tabs-scroller">
            {primary.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    "events-hub-tab inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-label hover:text-foreground",
                  ].join(" ")
                }
              >
                <span>{tab.label}</span>
                <NavCountBadge
                  count={tab.badgeCount ?? 0}
                  className="events-hub-tab-badge h-4 min-w-4 px-1 text-[10px]"
                />
              </NavLink>
            ))}
          </div>
          <span
            className="events-hub-tabs-fade events-hub-tabs-fade--left"
            aria-hidden="true"
          />
          <span
            className="events-hub-tabs-fade events-hub-tabs-fade--right"
            aria-hidden="true"
          />
        </div>
        <EventsMoreMenu items={more} />
      </div>
    </nav>
  );
}

export function EventsHubLayout() {
  const { member } = useAuth();
  const { summary } = useNotificationSummary();
  const isManageView = Boolean(useMatch("/events/:eventId/manage"));
  const isMeetingDetailView = Boolean(useMatch("/events/meetings/:eventId"));
  const isCustomAlbumView = Boolean(useMatch("/events/media/album/:albumId"));
  // Match only event albums (`/events/media/123`), not `/events/media` or custom albums.
  const isEventAlbumView =
    Boolean(useMatch({ path: "/events/media/:eventId", end: true })) &&
    !isCustomAlbumView;

  if (
    isManageView ||
    isMeetingDetailView ||
    isEventAlbumView ||
    isCustomAlbumView
  ) {
    return <Outlet />;
  }

  const myTasksCount = summary.tasks_overdue + summary.tasks_due_today;
  const suggestionsCount = member
    ? memberSatisfiesMinRole(member, "board")
      ? summary.suggestions_pending
      : 0
    : 0;
  const oversightCount =
    member && canViewTaskOversight(member.role, member.position)
      ? summary.tasks_oversight_overdue
      : 0;

  const plan = member
    ? buildEventsTabs(member, {
        myTasks: myTasksCount,
        suggestions: suggestionsCount,
        oversight: oversightCount,
      })
    : {
        primary: [{ label: "Calendar", to: "/events/calendar" }],
        more: [] as EventsTab[],
      };

  return (
    <div className="events-hub-shell">
      <EventsHubTabBar primary={plan.primary} more={plan.more} />
      <Outlet />
    </div>
  );
}
