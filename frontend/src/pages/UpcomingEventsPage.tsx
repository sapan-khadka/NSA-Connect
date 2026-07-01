import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { eventDetailPath } from "../lib/event-links";
import { fetchUpcomingEvents, type EventResponse } from "../lib/events-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { formatEventDateTime } from "../lib/format-datetime";

export function UpcomingEventsPage() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchUpcomingEvents();
        if (!cancelled) {
          setEvents(response.events);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="ds-card p-8">
        <p className="ds-section-label">
          Events
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-headline text-foreground">Upcoming events</h1>
        <p className="mt-3 max-w-2xl text-label">
          Open an event to manage its tasks, budget, and completion progress in
          one place.
        </p>
      </section>

      {isLoading ? (
        <p className="text-sm text-label">Loading upcoming events…</p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="ds-alert-banner p-6"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && events.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-light tracking-subhead text-foreground">No upcoming events</p>
          <p className="mt-2 text-label">
            Check back when new events are scheduled.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            Open calendar
          </Link>
        </section>
      ) : null}

      {!isLoading && !error && events.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                to={eventDetailPath(event.id)}
                className="block ds-card ds-card-interactive p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-light tracking-subhead text-foreground">
                      {event.name}
                    </h2>
                    <p className="mt-1 text-sm text-label">
                      {formatEventDateTime(event.starts_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
                  >
                    {EVENT_TYPE_LABELS[event.event_type]}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-label">
                  {event.description}
                </p>
                <p className="mt-4 text-sm font-medium text-accent">
                  View event ›
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
