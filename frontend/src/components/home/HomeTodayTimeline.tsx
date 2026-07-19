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

function isSameLocalDay(isoDate: string, day: Date): boolean {
  const start = startOfLocalDay(day).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  const value = new Date(isoDate).getTime();
  return value >= start && value < end;
}

const DOT_TONES = [
  "bg-primary",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-500",
] as const;

export function HomeTodayTimeline({
  events,
  isLoading,
}: {
  events: EventResponse[];
  isLoading: boolean;
}) {
  const now = new Date();
  const todayItems = events
    .filter((event) => isSameLocalDay(event.starts_at, now))
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    )
    .slice(0, 4);

  return (
    <HomeCard
      padding="xs"
      className="home-surface-quiet"
      aria-label="Today's Timeline"
    >
      <h2 className="home-section-title">Today&apos;s Timeline</h2>

      <div className="mt-2">
        {isLoading ? (
          <p className="text-xs text-gray-600">Loading timeline…</p>
        ) : null}

        {!isLoading && todayItems.length === 0 ? (
          <p className="text-xs text-gray-600">Nothing scheduled for today.</p>
        ) : null}

        {!isLoading && todayItems.length > 0 ? (
          <ol className="space-y-0">
            {todayItems.map((event, index) => {
              const when = relativeWhen(event.starts_at, now);
              const isNow = when === "Now";
              return (
                <li key={event.id} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                  {index < todayItems.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[0.35rem] top-4 bottom-0 w-px bg-gray-200"
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={[
                      "relative z-10 mt-1 h-2 w-2 shrink-0 rounded-full ring-2 ring-white",
                      DOT_TONES[index % DOT_TONES.length],
                    ].join(" ")}
                  />
                  <Link
                    to={eventDetailPath(event.id)}
                    className="min-w-0 flex-1 rounded-md transition hover:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {event.name}
                        </p>
                        <p className="mt-0.5 text-[10px] tabular-nums text-gray-500">
                          {formatClock(event.starts_at)}
                        </p>
                      </div>
                      <span
                        className={[
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          isNow
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-gray-100 text-gray-600",
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
        ) : null}
      </div>
    </HomeCard>
  );
}
