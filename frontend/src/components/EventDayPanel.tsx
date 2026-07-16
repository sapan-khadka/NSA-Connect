/**
 * Calendar sidebar event inspector shell.
 * Detail content (cover hero, RSVP, actions) lives in EventOverviewCard.
 */

import { EventOverviewCard } from "./EventOverviewCard";
import {
  UPCOMING_GROUP_LABELS,
  UPCOMING_GROUP_ORDER,
  groupUpcomingEvents,
} from "../lib/calendar-upcoming";
import { EVENT_TYPE_DOT_CLASS } from "../lib/event-types";
import type { EventDetailResponse, EventResponse, RsvpStatus } from "../lib/events-api";
import { AppIcon } from "./ui/AppIcon";
import { Clock } from "lucide-react";

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
  onBackToUpcoming: () => void;
  showingDefaultUpcoming?: boolean;
  /** Mobile bottom-sheet presentation */
  presentation?: "aside" | "sheet";
};

function formatUpcomingDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

/** Relocated from the old permanent Upcoming sidebar — reuse in the drawer. */
export function UpcomingEventsList({
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
            <div className="ds-icon-label">
              {group === "this_week" ? (
                <AppIcon icon={Clock} size="sm" className="text-overdue" />
              ) : null}
              <h3
                className={[
                  "text-xs font-semibold uppercase tracking-wide",
                  group === "this_week" ? "text-overdue" : "text-label",
                ].join(" ")}
              >
                {UPCOMING_GROUP_LABELS[group]}
              </h3>
            </div>
            <ul className="mt-2 space-y-2 pl-0.5">
              {groupEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent?.(event)}
                    className="events-upcoming-event-card text-sm"
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
  onBackToUpcoming,
  showingDefaultUpcoming = false,
  presentation = "aside",
}: EventDayPanelProps) {
  return (
    <aside
      aria-label="Event details"
      className={[
        presentation === "sheet"
          ? "events-preview-sheet"
          : "events-preview-aside",
      ].join(" ")}
    >
      <EventOverviewCard
        selectedDate={selectedDate}
        dayEvents={dayEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={onSelectEvent}
        eventDetail={eventDetail}
        detailLoading={detailLoading}
        detailError={detailError}
        rsvpLoading={rsvpLoading}
        onRsvpStatusChange={onRsvpStatusChange}
        onBackToUpcoming={onBackToUpcoming}
        showingDefaultUpcoming={showingDefaultUpcoming}
      />
    </aside>
  );
}
