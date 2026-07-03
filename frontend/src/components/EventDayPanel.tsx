import { Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { eventDetailPath } from "../lib/event-links";
import {
  EVENT_TYPE_DOT_CLASS,
  EVENT_TYPE_LABELS,
} from "../lib/event-types";
import type { EventDetailResponse, EventResponse, RsvpStatus } from "../lib/events-api";
import {
  formatEventDateTime,
  formatIsoDateLabel,
} from "../lib/format-datetime";
import { isEventUpcoming } from "../lib/event-rsvp";
import {
  UPCOMING_GROUP_LABELS,
  UPCOMING_GROUP_ORDER,
  groupUpcomingEvents,
} from "../lib/calendar-upcoming";
import { EventRsvpButton } from "./EventRsvpButton";

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
  onSelectUpcomingEvent?: (event: EventResponse) => void;
};

function formatUpcomingDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

function UpcomingEventsSidebar({
  events,
  loading,
  onSelectEvent,
}: {
  events: EventResponse[];
  loading: boolean;
  onSelectEvent?: (event: EventResponse) => void;
}) {
  if (loading) {
    return <p className="text-sm text-label">Loading upcoming events…</p>;
  }

  const groups = groupUpcomingEvents(events);
  const hasAny = UPCOMING_GROUP_ORDER.some(
    (group) => groups[group].length > 0,
  );

  if (!hasAny) {
    return (
      <p className="text-sm text-label">No upcoming events scheduled yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {UPCOMING_GROUP_ORDER.map((group) => {
        const groupEvents = groups[group];
        if (groupEvents.length === 0) {
          return null;
        }

        return (
          <section key={group}>
            <div className="flex items-center gap-1.5">
              {group === "this_week" ? (
                <Clock
                  className="h-3.5 w-3.5 text-[#E8590C]"
                  aria-hidden="true"
                />
              ) : null}
              <h3
                className={[
                  "text-xs font-semibold uppercase tracking-wide",
                  group === "this_week" ? "text-[#E8590C]" : "text-label",
                ].join(" ")}
              >
                {UPCOMING_GROUP_LABELS[group]}
              </h3>
            </div>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pl-0.5">
              {groupEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent?.(event)}
                    className="flex w-full items-center gap-2 text-left text-sm hover:opacity-80"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-[5px] w-[5px] shrink-0 rounded-full ${EVENT_TYPE_DOT_CLASS[event.event_type]}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {event.name}
                    </span>
                    <span className="shrink-0 text-xs text-label">
                      {formatUpcomingDate(event.starts_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-b border-[#F0F0EE] last:hidden" />
          </section>
        );
      })}
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
  onSelectUpcomingEvent,
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
      <div className="events-sidebar-card p-5">
        <h2 className="text-base font-medium text-foreground">Upcoming</h2>
        <div className="mt-4">
          <UpcomingEventsSidebar
            events={upcomingEvents}
            loading={upcomingLoading}
            onSelectEvent={onSelectUpcomingEvent}
          />
        </div>
      </div>

      <div className="events-sidebar-card p-5">
        {selectedDate ? (
          <>
            <p className="text-xs text-label">{formatIsoDateLabel(selectedDate)}</p>

            {dayEvents.length === 0 && !detailLoading ? (
              <p className="mt-3 text-sm text-label">No events on this day.</p>
            ) : null}

            {dayEvents.length > 1 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
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
                            ? "bg-primary text-white"
                            : "bg-[#F5F5F7] text-foreground hover:bg-[#EBEBED]",
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
              <p className="mt-3 text-sm text-label">Loading event…</p>
            ) : null}

            {detailError ? (
              <p className="mt-3 ds-field-error">{detailError}</p>
            ) : null}

            {previewEvent ? (
              <div className="mt-4 rounded-[10px] border border-[#F0F0EE] bg-[#FAFAF9] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium text-foreground">
                    <Link
                      to={eventDetailPath(previewEvent.id)}
                      className="hover:text-accent"
                    >
                      {previewEvent.name}
                    </Link>
                  </h3>
                  <span className="rounded-full bg-mint/40 px-2 py-0.5 text-xs font-medium text-primary">
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
      </div>
    </aside>
  );
}
