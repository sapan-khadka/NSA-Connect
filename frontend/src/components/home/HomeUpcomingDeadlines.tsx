import { CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

import { eventDetailPath } from "../../lib/event-links";
import type { EventResponse } from "../../lib/events-api";
import { formatCountdownBadge } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { HomeCard } from "../ui/HomeCard";

function formatDeadlineDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

function countdownTone(isoDate: string, now = new Date()): string {
  const days = Math.floor(
    (new Date(isoDate).getTime() - now.getTime()) / 86_400_000,
  );
  if (days <= 7) {
    return "text-rose-700 bg-rose-50";
  }
  if (days <= 21) {
    return "text-amber-800 bg-amber-50";
  }
  return "text-emerald-800 bg-emerald-50";
}

export function HomeUpcomingDeadlines({
  events,
  isLoading,
}: {
  events: EventResponse[];
  isLoading: boolean;
}) {
  const deadlines = [...events]
    .filter((event) => new Date(event.starts_at).getTime() >= Date.now())
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    )
    .slice(0, 3);

  return (
    <HomeCard
      padding="xs"
      className="home-surface-quiet"
      aria-label="Upcoming Deadlines"
    >
      <h2 className="home-section-title">Upcoming Deadlines</h2>

      <div className="mt-2">
        {isLoading ? (
          <p className="text-xs text-gray-600">Loading deadlines…</p>
        ) : null}

        {!isLoading && deadlines.length === 0 ? (
          <p className="text-xs text-gray-600">No upcoming deadlines.</p>
        ) : null}

        {!isLoading && deadlines.length > 0 ? (
          <ul className="space-y-1.5">
            {deadlines.map((event) => (
              <li key={event.id}>
                <Link
                  to={eventDetailPath(event.id)}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-2 py-1.5 transition hover:border-gray-200 hover:shadow-sm"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
                    <AppIcon
                      icon={CalendarDays}
                      size="xs"
                      className="text-current"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {event.name}
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {formatDeadlineDate(event.starts_at)}
                    </span>
                  </span>
                  <span
                    className={[
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      countdownTone(event.starts_at),
                    ].join(" ")}
                  >
                    {formatCountdownBadge(event.starts_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </HomeCard>
  );
}
