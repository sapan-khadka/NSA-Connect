/**
 * Horizontal upcoming-events strip for the calendar page.
 * Compact timeline cards (date · title · location · time · going).
 */

import { Clock3, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { toLocalIsoDate } from "../lib/calendar";
import {
  UPCOMING_GROUP_ORDER,
  groupUpcomingEvents,
} from "../lib/calendar-upcoming";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../lib/events-api";
import { AppIcon } from "./ui/AppIcon";

function formatStripDate(startsAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
    .format(new Date(startsAt))
    .toUpperCase();
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
  const [goingById, setGoingById] = useState<Record<number, number>>({});

  const stripEvents = useMemo(() => {
    const groups = groupUpcomingEvents(events);
    return UPCOMING_GROUP_ORDER.flatMap((group) => groups[group]);
  }, [events]);

  useEffect(() => {
    let cancelled = false;
    const ids = stripEvents.map((event) => event.id);

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
  }, [stripEvents]);

  return (
    <section className="events-upcoming-strip" aria-label="Upcoming events">
      <div className="events-upcoming-strip-header">
        <h2 className="events-upcoming-strip-title">Upcoming events</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="events-upcoming-strip-view-all"
        >
          View all
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {loading ? (
        <p className="events-upcoming-strip-empty">Loading upcoming events…</p>
      ) : stripEvents.length === 0 ? (
        <p className="events-upcoming-strip-empty">
          No upcoming events scheduled yet.
        </p>
      ) : (
        <ul className="events-upcoming-strip-track">
          {stripEvents.map((event) => {
            const going = goingById[event.id];
            const location = event.location?.trim() || "Location TBA";
            const eventIso = toLocalIsoDate(new Date(event.starts_at));
            const isSelected =
              selectedEventId != null
                ? event.id === selectedEventId
                : selectedDate != null && eventIso === selectedDate;

            return (
              <li key={event.id} className="events-upcoming-strip-item">
                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className={[
                    "events-upcoming-strip-card",
                    isSelected ? "events-upcoming-strip-card--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                >
                  <p className="events-upcoming-strip-when">
                    <span
                      className="events-upcoming-strip-dot"
                      aria-hidden="true"
                    />
                    <span>{formatStripDate(event.starts_at)}</span>
                  </p>
                  <p className="events-upcoming-strip-name">{event.name}</p>
                  <p className="events-upcoming-strip-location">
                    <AppIcon
                      icon={MapPin}
                      size="xs"
                      className="text-current"
                    />
                    <span className="truncate">{location}</span>
                  </p>
                  <p className="events-upcoming-strip-footer">
                    <span className="events-upcoming-strip-time">
                      <AppIcon
                        icon={Clock3}
                        size="xs"
                        className="text-current"
                      />
                      <span>{formatStripTime(event.starts_at)}</span>
                    </span>
                    {going != null ? (
                      <>
                        <span
                          className="events-upcoming-strip-sep"
                          aria-hidden="true"
                        />
                        <span>{going} going</span>
                      </>
                    ) : null}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
