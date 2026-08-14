/**
 * Compact upcoming list under the calendar grid.
 */

import { useMemo } from "react";

import { toLocalIsoDate } from "../lib/calendar";
import {
  UPCOMING_GROUP_ORDER,
  groupUpcomingEvents,
} from "../lib/calendar-upcoming";
import type { EventResponse } from "../lib/events-api";
import { EVENT_TYPE_DOT_CLASS } from "../lib/event-types";
import { CalendarEventMark } from "./calendar-grid-utils";

function formatStripDate(startsAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(startsAt));
}

const VISIBLE_LIMIT = 4;

type UpcomingEventsStripProps = {
  events: EventResponse[];
  loading: boolean;
  selectedEventId?: number | null;
  selectedDate?: string | null;
  onSelectEvent: (event: EventResponse) => void;
  onViewAll: () => void;
};

export function UpcomingEventsStrip({
  events,
  loading,
  selectedEventId = null,
  selectedDate = null,
  onSelectEvent,
  onViewAll,
}: UpcomingEventsStripProps) {
  const stripEvents = useMemo(() => {
    const groups = groupUpcomingEvents(events);
    return UPCOMING_GROUP_ORDER.flatMap((group) => groups[group]);
  }, [events]);

  const visibleEvents = stripEvents.slice(0, VISIBLE_LIMIT);

  return (
    <section className="events-upcoming-strip" aria-label="Upcoming events">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Upcoming</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="ds-view-all"
        >
          View all
        </button>
      </div>

      {loading ? (
        <p className="event-command-stat">Loading upcoming events…</p>
      ) : stripEvents.length === 0 ? (
        <p className="event-command-stat">No upcoming events yet.</p>
      ) : (
        <ul className="events-upcoming-strip-list">
          {visibleEvents.map((event) => {
            const eventIso = toLocalIsoDate(new Date(event.starts_at));
            const isSelected =
              selectedEventId != null
                ? event.id === selectedEventId
                : selectedDate != null && eventIso === selectedDate;

            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className={[
                    "events-upcoming-strip-row",
                    isSelected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                >
                  <CalendarEventMark
                    className={EVENT_TYPE_DOT_CLASS[event.event_type]}
                    kind={event.event_type}
                    size="row"
                  />
                  <span className="events-upcoming-strip-name">{event.name}</span>
                  <time
                    className="events-upcoming-strip-when"
                    dateTime={event.starts_at}
                  >
                    {formatStripDate(event.starts_at)}
                  </time>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
