import { Link } from "react-router-dom";

import { startOfLocalDay } from "../../lib/calendar";
import { eventDetailPath } from "../../lib/event-links";
import type { EventResponse } from "../../lib/events-api";
import { HomeCard } from "../ui/HomeCard";

function formatClock(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function relativeWhen(isoDate: string, now = new Date()): string {
  const start = new Date(isoDate).getTime();
  const diffMs = start - now.getTime();
  if (!Number.isFinite(diffMs)) {
    return "";
  }
  if (diffMs <= 0 && Math.abs(diffMs) < 45 * 60_000) {
    return "Now";
  }
  if (diffMs <= 0) {
    return "Passed";
  }
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) {
    return `In ${hours}h`;
  }
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return `In ${minutes}m`;
}

export function isSameLocalDay(isoDate: string, day: Date = new Date()): boolean {
  const start = startOfLocalDay(day).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  const value = new Date(isoDate).getTime();
  return value >= start && value < end;
}

/** Events/meetings starting today, soonest first (max 4). */
export function getTodayTimelineItems(
  events: EventResponse[],
  now = new Date(),
): EventResponse[] {
  return events
    .filter((event) => isSameLocalDay(event.starts_at, now))
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    )
    .slice(0, 4);
}

const DOT_TONES = [
  "bg-primary",
  "bg-amber-500",
  "bg-sky-500",
  "bg-teal-600",
  "bg-rose-500",
] as const;

/**
 * Compact today-only schedule. Returns null when nothing is scheduled today
 * so Home can give Work Center full width.
 */
export function HomeTodayTimeline({
  events,
  now = new Date(),
}: {
  events: EventResponse[];
  now?: Date;
}) {
  const todayItems = getTodayTimelineItems(events, now);

  if (todayItems.length === 0) {
    return null;
  }

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet flex h-full min-h-0 flex-col"
      aria-label="Today's Timeline"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-section-title">Today</h2>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 ring-1 ring-inset ring-gray-200/80">
          {todayItems.length}
        </span>
      </div>

      <ol className="relative mt-4 min-h-0 flex-1 space-y-0 overflow-y-auto">
        {todayItems.map((event, index) => {
          const when = relativeWhen(event.starts_at, now);
          const isNow = when === "Now";
          return (
            <li
              key={event.id}
              className="relative flex gap-3 pb-3 last:pb-0"
            >
              {index < todayItems.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[0.4rem] top-5 bottom-0 w-px bg-gradient-to-b from-gray-200 to-transparent"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={[
                  "relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-[3px] ring-white",
                  DOT_TONES[index % DOT_TONES.length],
                ].join(" ")}
              />
              <Link
                to={eventDetailPath(event.id)}
                className="home-interactive-row min-w-0 flex-1 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-gray-200/80 hover:bg-white/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.name}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-gray-500">
                      {formatClock(event.starts_at)}
                      {event.event_type === "meeting" ? " · Meeting" : ""}
                    </p>
                  </div>
                  <span
                    className={[
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isNow
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100"
                        : "bg-gray-100/90 text-gray-600",
                    ].join(" ")}
                  >
                    {when}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </HomeCard>
  );
}
