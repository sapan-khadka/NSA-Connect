import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchUpcomingEvents, type EventResponse } from "../lib/events-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { formatEventDateTime } from "../lib/format-datetime";
import { isRoleAtLeast } from "../lib/roles";

export function UpcomingEventsPage() {
  const { member } = useAuth();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = member ? isRoleAtLeast(member.role, "board") : false;

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
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Events
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Upcoming events</h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Open an event to manage its tasks, budget, and completion progress in
          one place.
        </p>
      </section>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading upcoming events…</p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && events.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-primary">No upcoming events</p>
          <p className="mt-2 text-gray-500">
            Check back when new events are scheduled.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
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
                to={`/events/${event.id}/manage`}
                className="block rounded-lg border border-gray-200 bg-white p-5 transition hover:border-accent hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">
                      {event.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatEventDateTime(event.starts_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
                  >
                    {EVENT_TYPE_LABELS[event.event_type]}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                  {event.description}
                </p>
                {canManage ? (
                  <p className="mt-4 text-sm font-medium text-accent">
                    Manage tasks & budget →
                  </p>
                ) : (
                  <p className="mt-4 text-sm font-medium text-accent">
                    View event →
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
