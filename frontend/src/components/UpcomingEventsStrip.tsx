/**
 * Horizontal upcoming-events strip for the calendar page.
 * Compact timeline cards (date · title · location · time · going).
 */

import { useEffect, useState } from "react";

import { EVENT_TYPE_COLOR, type EventType } from "../lib/event-types";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../lib/events-api";

function formatStripDate(startsAt: string): string {
  const date = new Date(startsAt);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, tomorrow)) {
    return "Tomorrow";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatStripTime(startsAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

type UpcomingEventsStripProps = {
  events: EventResponse[];
  loading: boolean;
  onSelectEvent: (event: EventResponse) => void;
  onViewAll: () => void;
};

export function UpcomingEventsStrip({
  events,
  loading,
  onSelectEvent,
  onViewAll,
}: UpcomingEventsStripProps) {
  const [goingById, setGoingById] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    const ids = events.map((event) => event.id);

    if (ids.length === 0) {
      setGoingById({});
      return;
    }

    void Promise.all(
      ids.map(async (eventId) => {
        try {
          const response = await fetchEventAttendees(eventId);
          return [eventId, response.going_count] as const;
        } catch {
          return [eventId, 0] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) {
        return;
      }
      const next: Record<number, number> = {};
      for (const [eventId, count] of rows) {
        next[eventId] = count;
      }
      setGoingById(next);
    });

    return () => {
      cancelled = true;
    };
  }, [events]);

  return (
    <section className="events-upcoming-strip" aria-label="Upcoming events">
      <div className="events-upcoming-strip-header">
        <h2 className="events-upcoming-strip-title">Upcoming events</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="events-upcoming-strip-view-all"
        >
          View all →
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-label">Loading upcoming events…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-label">No upcoming events scheduled yet.</p>
      ) : (
        <ul className="events-upcoming-strip-track">
          {events.map((event) => {
            const going = goingById[event.id];
            const accent =
              EVENT_TYPE_COLOR[(event.event_type ?? "social") as EventType];
            const location = event.location?.trim();

            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="events-upcoming-strip-card"
                  style={{ borderLeftColor: accent }}
                >
                  <p className="events-upcoming-strip-when">
                    {formatStripDate(event.starts_at)}
                  </p>
                  <p className="events-upcoming-strip-name">{event.name}</p>
                  {location ? (
                    <p className="events-upcoming-strip-location truncate">
                      {location}
                    </p>
                  ) : null}
                  <div className="events-upcoming-strip-footer">
                    <span>{formatStripTime(event.starts_at)}</span>
                    {going != null ? <span>{going} going</span> : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
