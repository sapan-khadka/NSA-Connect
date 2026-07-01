import { Link } from "react-router-dom";

import { EventRsvpButton } from "./EventRsvpButton";
import { eventDetailPath } from "../lib/event-links";
import type { EventDetailResponse, EventResponse, RsvpStatus } from "../lib/events-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import {
  formatEventDateTime,
  formatIsoDateLabel,
} from "../lib/format-datetime";
import { isEventUpcoming } from "../lib/event-rsvp";

type EventDayPanelProps = {
  selectedDate: string | null;
  dayEvents: EventResponse[];
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
  eventDetail: EventDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  rsvpLoading: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
  upcomingEvents?: EventResponse[];
  upcomingLoading?: boolean;
};

function formatUpcomingDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(isoDate));
}

function UpcomingEventsList({
  events,
  loading,
}: {
  events: EventResponse[];
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-label">Loading upcoming events…</p>;
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-label">No upcoming events scheduled yet.</p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-label">
        Coming up
      </p>
      <ul className="mt-2 space-y-1.5">
        {events.map((event) => (
          <li key={event.id} className="text-sm">
            <Link to={eventDetailPath(event.id)} className="text-foreground hover:text-accent">
              {event.name}
            </Link>
            <span className="text-label"> · {formatUpcomingDate(event.starts_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EventDayPanel({
  selectedDate,
  dayEvents,
  selectedEventId,
  onSelectEvent,
  eventDetail,
  detailLoading,
  detailError,
  rsvpLoading,
  onRsvpStatusChange,
  upcomingEvents = [],
  upcomingLoading = false,
}: EventDayPanelProps) {
  const previewEvent =
    eventDetail ??
    dayEvents.find((event) => event.id === selectedEventId) ??
    dayEvents[0] ??
    null;

  return (
    <aside
      aria-label="Event details"
      className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
    >
      {selectedDate ? (
        <>
          <p className="text-xs text-label">{formatIsoDateLabel(selectedDate)}</p>

          {dayEvents.length === 0 && !detailLoading ? (
            <p className="text-sm text-label">No events on this day.</p>
          ) : null}

          {dayEvents.length > 1 ? (
            <ul className="flex flex-wrap gap-2">
              {dayEvents.map((event) => {
                const isActive = event.id === selectedEventId;
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onSelectEvent(event.id)}
                      className={[
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-accent text-white"
                          : "bg-surface-card text-foreground hover:bg-surface-muted",
                      ].join(" ")}
                    >
                      {event.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {detailLoading ? (
            <p className="text-sm text-label">Loading event…</p>
          ) : null}

          {detailError ? (
            <p className="ds-field-error">{detailError}</p>
          ) : null}

          {previewEvent ? (
            <div className="ds-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium text-foreground">
                  <Link
                    to={eventDetailPath(previewEvent.id)}
                    className="hover:text-accent"
                  >
                    {previewEvent.name}
                  </Link>
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[previewEvent.event_type]}`}
                >
                  {EVENT_TYPE_LABELS[previewEvent.event_type]}
                </span>
              </div>
              <p className="mt-2 text-sm text-label">
                {formatEventDateTime(previewEvent.starts_at)}
              </p>

              {eventDetail ? (
                <EventRsvpButton
                  currentStatus={eventDetail.current_member_rsvp_status}
                  canRsvp={isEventUpcoming(eventDetail.starts_at)}
                  loading={rsvpLoading}
                  onStatusChange={onRsvpStatusChange}
                  embedded
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-label">
          Select a day on the calendar to see event details and RSVP.
        </p>
      )}

      <UpcomingEventsList events={upcomingEvents} loading={upcomingLoading} />
    </aside>
  );
}
