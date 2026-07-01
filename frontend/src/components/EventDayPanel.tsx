import { Link } from "react-router-dom";

import { EventRsvpButton } from "./EventRsvpButton";
import { EventTaskManager } from "./EventTaskManager";
import { ArrowLink } from "./ui/ArrowLink";
import type { MemberResponse } from "../lib/auth-api";
import { eventDetailPath } from "../lib/event-links";
import type { EventDetailResponse, EventResponse, RsvpStatus } from "../lib/events-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import {
  formatCurrency,
  formatEventDateTime,
  formatIsoDateLabel,
} from "../lib/format-datetime";
import { isEventUpcoming } from "../lib/event-rsvp";
import { isRoleAtLeast } from "../lib/roles";

type EventDayPanelProps = {
  selectedDate: string | null;
  dayEvents: EventResponse[];
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
  eventDetail: EventDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  member: MemberResponse | null;
  canManageSimple: boolean;
  canAssignChecklist: boolean;
  assignableMembers: MemberResponse[];
  taskRefreshKey: number;
  onChecklistTasksChange?: (tasks: EventDetailResponse["prep_tasks"]) => void;
  rsvpLoading: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
  canDeleteEvent?: boolean;
  deletingEvent?: boolean;
  onDeleteEvent?: (eventId: number) => void;
  upcomingEvents?: EventResponse[];
  upcomingLoading?: boolean;
};

function UpcomingEventsSidebar({
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
      <p className="text-sm text-label">
        No upcoming events scheduled yet.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-label">
        Upcoming events
      </p>
      <ul className="mt-3 space-y-2">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              to={eventDetailPath(event.id)}
              className="block rounded-lg border border-gray-200 px-3 py-2 transition hover:border-accent/40 hover:bg-gray-50"
            >
              <p className="font-medium text-foreground">{event.name}</p>
              <p className="mt-0.5 text-xs text-label">
                {formatEventDateTime(event.starts_at)}
              </p>
            </Link>
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
  member,
  canManageSimple,
  canAssignChecklist,
  assignableMembers,
  taskRefreshKey,
  onChecklistTasksChange,
  rsvpLoading,
  onRsvpStatusChange,
  canDeleteEvent = false,
  deletingEvent = false,
  onDeleteEvent,
  upcomingEvents = [],
  upcomingLoading = false,
}: EventDayPanelProps) {
  const canViewBudget = member
    ? isRoleAtLeast(member.role, "board")
    : false;
  const showTasksExpanded =
    canManageSimple || canAssignChecklist || member?.role !== "general";

  return (
    <aside
      aria-label="Event details"
      className="rounded-card bg-surface-card p-4 sm:p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
    >
      {!selectedDate ? (
        <UpcomingEventsSidebar
          events={upcomingEvents}
          loading={upcomingLoading}
        />
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-label">
            Selected day
          </p>
          <h2 className="mt-1 text-lg font-light tracking-subhead text-foreground">
            {formatIsoDateLabel(selectedDate)}
          </h2>

          {dayEvents.length === 0 && !eventDetail && !detailLoading ? (
            <p className="mt-4 text-sm text-label">No events on this day.</p>
          ) : (
            <>
              {dayEvents.length > 1 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
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
                              : "bg-gray-100 text-foreground hover:bg-gray-200",
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
                <p className="mt-4 text-sm text-label">Loading event details…</p>
              ) : null}

              {detailError ? (
                <p className="mt-4 ds-field-error">{detailError}</p>
              ) : null}

              {eventDetail ? (
                <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-foreground">
                        <Link
                          to={eventDetailPath(eventDetail.id)}
                          className="hover:text-accent"
                        >
                          {eventDetail.name}
                        </Link>
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[eventDetail.event_type]}`}
                      >
                        {EVENT_TYPE_LABELS[eventDetail.event_type]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-label">
                      {formatEventDateTime(eventDetail.starts_at)}
                    </p>
                    {eventDetail.location ? (
                      <p className="mt-1 text-sm text-label">
                        {eventDetail.location}
                      </p>
                    ) : null}
                    {canViewBudget ? (
                      <p className="mt-1 text-sm text-label">
                        Budget {formatCurrency(eventDetail.budget)}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm leading-relaxed text-foreground">
                      {eventDetail.description}
                    </p>

                    <div className="mt-3">
                      <ArrowLink to={eventDetailPath(eventDetail.id)}>
                        View full details
                      </ArrowLink>
                    </div>

                    {canDeleteEvent && onDeleteEvent ? (
                      <button
                        type="button"
                        disabled={deletingEvent}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${eventDetail.name}"? This removes the event and its RSVPs and tasks. This cannot be undone.`,
                            )
                          ) {
                            onDeleteEvent(eventDetail.id);
                          }
                        }}
                        className="mt-4 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-label transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingEvent ? "Deleting…" : "Delete event"}
                      </button>
                    ) : null}
                  </div>

                  <EventRsvpButton
                    currentStatus={eventDetail.current_member_rsvp_status}
                    canRsvp={isEventUpcoming(eventDetail.starts_at)}
                    loading={rsvpLoading}
                    onStatusChange={onRsvpStatusChange}
                  />

                  {eventDetail.event_type === "meeting" &&
                  member &&
                  isRoleAtLeast(member.role, "board") ? (
                    <Link
                      to={`/events/meetings/${eventDetail.id}`}
                      className="inline-flex text-sm font-medium text-accent"
                    >
                      View meeting record ›
                    </Link>
                  ) : null}

                  {showTasksExpanded ? (
                    <EventTaskManager
                      key={`${eventDetail.id}-${taskRefreshKey}`}
                      eventId={eventDetail.id}
                      eventName={eventDetail.name}
                      member={member}
                      canManageSimple={canManageSimple}
                      canAssignChecklist={canAssignChecklist}
                      assignableMembers={assignableMembers}
                      fallbackChecklistTasks={eventDetail.prep_tasks}
                      onFallbackTasksChange={onChecklistTasksChange}
                      refreshKey={taskRefreshKey}
                    />
                  ) : (
                    <details className="rounded-lg border border-surface-card bg-surface-muted/40 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-foreground">
                        Tasks & volunteer
                      </summary>
                      <div className="mt-3">
                        <EventTaskManager
                          key={`${eventDetail.id}-${taskRefreshKey}`}
                          eventId={eventDetail.id}
                          eventName={eventDetail.name}
                          member={member}
                          canManageSimple={canManageSimple}
                          canAssignChecklist={canAssignChecklist}
                          assignableMembers={assignableMembers}
                          fallbackChecklistTasks={eventDetail.prep_tasks}
                          onFallbackTasksChange={onChecklistTasksChange}
                          refreshKey={taskRefreshKey}
                        />
                      </div>
                    </details>
                  )}
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </aside>
  );
}
