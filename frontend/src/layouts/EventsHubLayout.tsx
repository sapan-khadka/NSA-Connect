import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NavLink, Outlet, useLocation, useMatch } from "react-router-dom";

import {
  NavCountBadge,
  useNotificationSummary,
} from "../context/NotificationSummaryProvider";
import { useAuth } from "../context/useAuth";
import {
  canViewMemberDirectory,
  canViewTaskOversight,
} from "../lib/roles";

type EventsTab = {
  label: string;
  to: string;
  end?: boolean;
  badgeCount?: number;
};

function buildEventsTabs(
  member: NonNullable<ReturnType<typeof useAuth>["member"]>,
  counts: {
    myTasks: number;
    suggestions: number;
    oversight: number;
  },
): EventsTab[] {
  const tabs: EventsTab[] = [{ label: "Calendar", to: "/events/calendar" }];

  tabs.push({
    label: "My tasks",
    to: "/events/tasks",
    badgeCount: counts.myTasks,
  });

  tabs.push({ label: "Photo archive", to: "/events/photos" });
  tabs.push({
    label: "Suggestions",
    to: "/events/suggestions",
    badgeCount: counts.suggestions,
  });

  if (canViewMemberDirectory(member.role)) {
    tabs.push({ label: "Board meetings", to: "/events/meetings" });
    if (canViewTaskOversight(member.role, member.position)) {
      tabs.push({
        label: "Task oversight",
        to: "/events/oversight",
        badgeCount: counts.oversight,
      });
    }
    tabs.push({ label: "Past events", to: "/events/past" });
  }

  return tabs;
}

/**
 * Underline tab row with horizontal scroll + edge fades when more tabs exist.
 * Keeps the existing tab language (vs converting to pills).
 */
function EventsHubTabBar({ tabs }: { tabs: EventsTab[] }) {
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
  }, [tabs, updateOverflow]);

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
  }, [location.pathname, tabs, updateOverflow]);

  return (
    <nav
      aria-label="Events sections"
      className={[
        "events-hub-tabs sticky top-0 z-10 border-b border-gray-200 bg-surface/95 px-4 pb-0.5 backdrop-blur-sm sm:-mx-1 sm:border-surface-card sm:px-1",
        canScrollLeft ? "events-hub-tabs--fade-left" : "",
        canScrollRight ? "events-hub-tabs--fade-right" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        ref={scrollerRef}
        className="events-hub-tabs-scroller"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                "events-hub-tab inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-label hover:text-accent",
              ].join(" ")
            }
          >
            <span>{tab.label}</span>
            <NavCountBadge
              count={tab.badgeCount ?? 0}
              className="h-4 min-w-4 px-1 text-[10px]"
            />
          </NavLink>
        ))}
      </div>
      <span className="events-hub-tabs-fade events-hub-tabs-fade--left" aria-hidden="true" />
      <span className="events-hub-tabs-fade events-hub-tabs-fade--right" aria-hidden="true" />
    </nav>
  );
}

export function EventsHubLayout() {
  const { member } = useAuth();
  const { summary } = useNotificationSummary();
  const isManageView = Boolean(useMatch("/events/:eventId/manage"));
  const isMeetingDetailView = Boolean(useMatch("/events/meetings/:eventId"));
  const isPhotoAlbumView = Boolean(useMatch("/events/photos/:eventId"));

  if (isManageView || isMeetingDetailView || isPhotoAlbumView) {
    return <Outlet />;
  }

  const myTasksCount = summary.tasks_overdue + summary.tasks_due_today;
  const suggestionsCount = member
    ? canViewMemberDirectory(member.role)
      ? summary.suggestions_pending
      : 0
    : 0;
  const oversightCount =
    member && canViewTaskOversight(member.role, member.position)
      ? summary.tasks_oversight_overdue
      : 0;

  const tabs = member
    ? buildEventsTabs(member, {
        myTasks: myTasksCount,
        suggestions: suggestionsCount,
        oversight: oversightCount,
      })
    : [{ label: "Calendar", to: "/events/calendar" }];

  return (
    <div className="events-hub-shell">
      <EventsHubTabBar tabs={tabs} />
      <Outlet />
    </div>
  );
}
