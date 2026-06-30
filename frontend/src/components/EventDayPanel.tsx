import { Link } from "react-router-dom";

import { EventRsvpButton } from "./EventRsvpButton";
import { EventTaskManager } from "./EventTaskManager";
import type { MemberResponse } from "../lib/auth-api";
import type { EventDetailResponse, EventResponse } from "../lib/events-api";
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
  onRsvp: () => void;
  onCancelRsvp: () => void;
  canDeleteEvent?: boolean;
  deletingEvent?: boolean;
  onDeleteEvent?: (eventId: number) => void;
};

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
  onRsvp,
  onCancelRsvp,
  canDeleteEvent = false,
  deletingEvent = false,
  onDeleteEvent,
}: EventDayPanelProps) {
  const canViewBudget = member
    ? isRoleAtLeast(member.role, "board")
    : false;
  const showTasksExpanded =
    canManageSimple || canAssignChecklist || member?.role !== "general";

  return (
    <aside
      aria-label="Event details"
      className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
    >
      {!selectedDate ? (
        <p className="text-sm text-gray-600">
          Click a calendar day to view events and tasks.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Selected day
          </p>
          <h2 className="mt-1 text-lg font-semibold text-primary">
            {formatIsoDateLabel(selectedDate)}
          </h2>

          {dayEvents.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">No events on this day.</p>
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
                              ? "bg-primary text-white"
                              : "bg-gray-100 text-primary hover:bg-gray-200",
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
                <p className="mt-4 text-sm text-gray-500">Loading event details…</p>
              ) : null}

              {detailError ? (
                <p className="mt-4 text-sm text-red-600">{detailError}</p>
              ) : null}

              {eventDetail ? (
                <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-primary">
                        {eventDetail.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[eventDetail.event_type]}`}
                      >
                        {EVENT_TYPE_LABELS[eventDetail.event_type]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {formatEventDateTime(eventDetail.starts_at)}
                    </p>
                    {canViewBudget ? (
                      <p className="mt-1 text-sm text-gray-600">
                        Budget {formatCurrency(eventDetail.budget)}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm leading-relaxed text-gray-700">
                      {eventDetail.description}
                    </p>

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
                        className="mt-4 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingEvent ? "Deleting…" : "Delete event"}
                      </button>
                    ) : null}
                  </div>

                  <EventRsvpButton
                    hasRsvped={eventDetail.current_member_has_rsvped}
                    rsvpCount={eventDetail.rsvp_count}
                    canRsvp={isEventUpcoming(eventDetail.starts_at)}
                    loading={rsvpLoading}
                    onRsvp={onRsvp}
                    onCancelRsvp={onCancelRsvp}
                  />

                  {eventDetail.event_type === "meeting" &&
                  member &&
                  isRoleAtLeast(member.role, "board") ? (
                    <Link
                      to={`/events/meetings/${eventDetail.id}`}
                      className="inline-flex text-sm font-medium text-accent hover:text-accent-hover"
                    >
                      View meeting record →
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
                    <details className="rounded-lg border border-slate-200 bg-surface-muted/40 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">
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
