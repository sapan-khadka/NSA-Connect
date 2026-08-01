import { Link } from "react-router-dom";

import type { EventResponse } from "../../lib/events-api";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

function getDateBlockParts(isoDate: string): { month: string; day: string } {
  const date = new Date(isoDate);
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date),
  };
}

function formatEventWhen(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

type HomeUpcomingEventsProps = {
  events: EventResponse[];
  isLoading?: boolean;
  limit?: number;
  /** Skip the first event when Event Hero already features it. */
  skipFeatured?: boolean;
};

export function HomeUpcomingEvents({
  events,
  isLoading = false,
  limit = 4,
  skipFeatured = false,
}: HomeUpcomingEventsProps) {
  const source = skipFeatured ? events.slice(1) : events;
  const visible = source.slice(0, limit);

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-upcoming-events"
      aria-label="Upcoming events"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Coming up</h2>
        <ArrowLink to="/events">View all</ArrowLink>
      </div>

      {isLoading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="home-activity-empty">
          {skipFeatured && events.length > 0
            ? "No other upcoming events"
            : "No upcoming events"}
        </p>
      ) : (
        <ul className="home-upcoming-events-list">
          {visible.map((event) => {
            const date = getDateBlockParts(event.starts_at);
            return (
              <li key={event.id}>
                <Link
                  to={`/events/${event.id}`}
                  className="home-upcoming-event-row home-upcoming-event-row--link"
                >
                  <span className="home-upcoming-date-block" aria-hidden>
                    <span className="home-upcoming-date-block__month">
                      {date.month}
                    </span>
                    <span className="home-upcoming-date-block__day">
                      {date.day}
                    </span>
                  </span>
                  <span className="home-upcoming-event-copy">
                    <span className="home-upcoming-event-title">
                      {event.name}
                    </span>
                    <span className="home-upcoming-event-meta">
                      {formatEventWhen(event.starts_at)}
                      {event.location ? ` · ${event.location}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
