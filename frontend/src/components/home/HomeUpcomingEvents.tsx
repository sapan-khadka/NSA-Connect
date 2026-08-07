import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import type { CSSProperties } from "react";

import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABELS,
  type EventType,
} from "../../lib/event-types";
import type { EventResponse } from "../../lib/events-api";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

function formatEventSchedule(isoDate: string): {
  dateLine: string;
  timeLine: string;
} {
  const date = new Date(isoDate);
  return {
    dateLine: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date),
    timeLine: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

type HomeUpcomingEventsProps = {
  events: EventResponse[];
  isLoading?: boolean;
  limit?: number;
  /** Skip the first event when the featured banner already shows it. */
  skipFeatured?: boolean;
};

/**
 * Secondary event list for Home — light schedule rows (not date-card chrome).
 */
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
      aria-label="Upcoming Events"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Upcoming Events</h2>
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
            const schedule = formatEventSchedule(event.starts_at);
            const type = event.event_type as EventType;
            const typeColor = EVENT_TYPE_COLOR[type] ?? "#737373";
            const typeLabel = EVENT_TYPE_LABELS[type] ?? "Event";
            const location = event.location?.trim();

            return (
              <li key={event.id}>
                <Link
                  to={`/events/${event.id}`}
                  className="home-upcoming-event"
                  style={
                    {
                      ["--event-accent" as string]: typeColor,
                    } as CSSProperties
                  }
                >
                  <span className="home-upcoming-event__body">
                    <span className="home-upcoming-event__top">
                      <span className="home-upcoming-event__title">
                        {event.name}
                      </span>
                      <span className="home-upcoming-event__type">
                        {typeLabel}
                      </span>
                    </span>
                    <span className="home-upcoming-event__meta">
                      <span>{schedule.dateLine}</span>
                      <span className="home-upcoming-event__dot" aria-hidden>
                        ·
                      </span>
                      <span>{schedule.timeLine}</span>
                      {location ? (
                        <>
                          <span className="home-upcoming-event__dot" aria-hidden>
                            ·
                          </span>
                          <span className="home-upcoming-event__place">
                            {location}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <AppIcon
                    icon={ChevronRight}
                    size="sm"
                    className="home-upcoming-event__chev"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
