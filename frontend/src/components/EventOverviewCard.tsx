/**
 * Calendar sidebar — dense inspector panel for the selected event.
 * Presentation only; RSVP / manage handlers unchanged.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { Avatar } from "../design-system/components/Avatar";
import { useAuth } from "../context/useAuth";
import { EVENT_TYPE_LABELS, type EventType } from "../lib/event-types";
import { eventDetailPath } from "../lib/event-links";
import { isEventUpcoming } from "../lib/event-rsvp";
import { summarizeVolunteerSlots } from "../lib/event-volunteer-summary";
import {
  fetchEventAttendees,
  fetchEventVolunteerSlots,
  type EventDetailResponse,
  type EventResponse,
  type EventRsvpAttendee,
  type RsvpStatus,
} from "../lib/events-api";
import { fetchEventTasks } from "../lib/event-tasks-api";
import {
  fetchEventBudgetForEvent,
  type FinanceEventBudgetSummary,
} from "../lib/finance-api";
import { getFestivalsOnDate } from "../lib/nepali-calendar";
import { memberSatisfiesMinRole } from "../lib/roles";
import {
  DetailsActions,
  DetailsEmptyState,
  DetailsPanel,
  DetailsSection,
  DetailsSkeleton,
} from "./details-panel";
import { EventAttendeeStack } from "./EventAttendeeStack";
import { EventHealthCard } from "./EventHealthCard";
import { EventRsvpSegmented } from "./EventRsvpSegmented";

const AVATAR_STACK_MAX = 4;

export function formatEventCountdown(
  startsAt: string,
  now: Date = new Date(),
): string | null {
  const startMs = Date.parse(startsAt);
  if (Number.isNaN(startMs)) {
    return null;
  }
  const diffMs = startMs - now.getTime();
  if (diffMs <= 0) {
    return null;
  }
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 1) {
    return "1 day left";
  }
  return `${days} days left`;
}

function formatClockRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const startLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);

  if (!endsAt) {
    return startLabel;
  }
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) {
    return startLabel;
  }
  const endLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

/** Full panel date — e.g. "September 4, 2026" from ISO datetime. */
function formatPanelDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type EventOverviewCardProps = {
  selectedDate: string | null;
  dayEvents: EventResponse[];
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
  eventDetail: EventDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  rsvpLoading: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
  /** True when showing the default soonest-upcoming event (not a calendar day pick). */
  showingDefaultUpcoming?: boolean;
};

export function EventOverviewCard({
  selectedDate,
  dayEvents,
  selectedEventId,
  onSelectEvent,
  eventDetail,
  detailLoading,
  detailError,
  rsvpLoading,
  onRsvpStatusChange,
  showingDefaultUpcoming = false,
}: EventOverviewCardProps) {
  const { member } = useAuth();
  const canManage = member ? memberSatisfiesMinRole(member, "board") : false;
  const previewEvent =
    eventDetail ??
    dayEvents.find((event) => event.id === selectedEventId) ??
    dayEvents[0] ??
    null;
  const manageEventId = previewEvent?.id ?? selectedEventId;

  const [attendees, setAttendees] = useState<EventRsvpAttendee[]>([]);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [maybeCount, setMaybeCount] = useState(0);
  const [notGoingCount, setNotGoingCount] = useState(0);
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const [taskStats, setTaskStats] = useState<{
    done: number;
    total: number;
    overdue: number;
  } | null>(null);
  const [budget, setBudget] = useState<FinanceEventBudgetSummary | null>(null);
  const [volunteersFilled, setVolunteersFilled] = useState(0);
  const [volunteersNeeded, setVolunteersNeeded] = useState(0);
  const [volunteersTargetSet, setVolunteersTargetSet] = useState(false);

  useEffect(() => {
    setAttendeesExpanded(false);
  }, [previewEvent?.id]);

  useEffect(() => {
    if (!previewEvent) {
      setAttendees([]);
      setGoingCount(null);
      setMaybeCount(0);
      setNotGoingCount(0);
      setTaskStats(null);
      setBudget(null);
      setVolunteersFilled(0);
      setVolunteersNeeded(0);
      setVolunteersTargetSet(false);
      return;
    }

    let cancelled = false;
    const eventId = previewEvent.id;

    void fetchEventAttendees(eventId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setGoingCount(response.going_count);
        setMaybeCount(response.maybe_count);
        setNotGoingCount(response.not_going_count);
        setAttendees(
          response.attendees.filter((row) => row.rsvp_status === "going"),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAttendees([]);
          setGoingCount(null);
          setMaybeCount(0);
          setNotGoingCount(0);
        }
      });

    if (canManage) {
      void fetchEventTasks(eventId)
        .then((response) => {
          if (cancelled) {
            return;
          }
          const done = response.tasks.filter(
            (task) => task.status === "done",
          ).length;
          const overdue = response.tasks.filter(
            (task) =>
              task.is_overdue &&
              !task.is_complete &&
              task.status !== "done",
          ).length;
          setTaskStats({ done, total: response.tasks.length, overdue });
        })
        .catch(() => {
          if (!cancelled) {
            setTaskStats(null);
          }
        });

      void fetchEventBudgetForEvent(eventId)
        .then((summary) => {
          if (!cancelled) {
            setBudget(summary);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBudget(null);
          }
        });

      void fetchEventVolunteerSlots(eventId)
        .then((response) => {
          if (cancelled) {
            return;
          }
          const totals = summarizeVolunteerSlots(response.slots);
          setVolunteersFilled(totals.filled);
          setVolunteersNeeded(totals.needed);
          setVolunteersTargetSet(totals.hasTarget);
        })
        .catch(() => {
          if (!cancelled) {
            setVolunteersFilled(0);
            setVolunteersNeeded(0);
            setVolunteersTargetSet(false);
          }
        });
    } else {
      setTaskStats(null);
      setBudget(null);
      setVolunteersFilled(0);
      setVolunteersNeeded(0);
      setVolunteersTargetSet(false);
    }

    return () => {
      cancelled = true;
    };
  }, [previewEvent?.id, canManage]);

  const eventType = (previewEvent?.event_type ?? "social") as EventType;
  const whenLine = previewEvent
    ? [formatPanelDate(previewEvent.starts_at), formatClockRange(previewEvent.starts_at, previewEvent.ends_at)]
        .filter(Boolean)
        .join(" · ")
    : null;
  const locationLine = previewEvent?.location?.trim() || null;
  const preparationPct =
    taskStats && taskStats.total > 0
      ? Math.round((taskStats.done / taskStats.total) * 100)
      : 0;
  const checklistDone = taskStats?.done ?? 0;
  const checklistTotal = taskStats?.total ?? 0;
  const overdueTasks = taskStats?.overdue ?? 0;
  const plannedBudget = budget ? Number(budget.planned_budget) || 0 : 0;
  const spentBudget = budget ? Number(budget.actual_expense) || 0 : 0;
  const stackAttendees = useMemo(
    () =>
      attendees.map((attendee) => ({
        id: attendee.member_id,
        name: attendee.full_name,
      })),
    [attendees],
  );
  const showEmptySelect =
    !detailLoading &&
    !previewEvent &&
    !showingDefaultUpcoming &&
    dayEvents.length === 0 &&
    selectedDate == null;
  const showEmptyDay =
    !detailLoading &&
    !previewEvent &&
    !showingDefaultUpcoming &&
    selectedDate != null &&
    dayEvents.length === 0;
  const dayFestivals = selectedDate ? getFestivalsOnDate(selectedDate) : [];
  const attendeeTotal = goingCount ?? 0;

  return (
    <DetailsPanel
      className="events-sidebar-card event-overview-shell event-overview-shell--dense details-panel--sticky p-0"
      elevated={false}
      sticky
      aria-label="Event details"
    >
      {showEmptySelect ? (
        <DetailsEmptyState
          title="Select a day"
          description="Pick a date on the calendar to see the event."
        />
      ) : null}

      {dayEvents.length > 1 ? (
        <ul className="calendar-day-switch" aria-label="Events on this day">
          {dayEvents.map((event) => {
            const isActive = event.id === selectedEventId;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectEvent(event.id)}
                  className={["calendar-day-switch-btn", isActive ? "is-active" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {event.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showEmptyDay && dayFestivals.length > 0 ? (
        <div className="calendar-festival-empty" role="status">
          <p className="event-command-kicker">Nepali festival</p>
          <h3 className="event-command-title">
            {dayFestivals.map((festival) => festival.name).join(" · ")}
          </h3>
          <p className="event-command-stat">No chapter events on this day.</p>
        </div>
      ) : null}

      {showEmptyDay && dayFestivals.length === 0 ? (
        <p className="details-panel-inline-empty px-4 pb-4">
          No events on this day.
        </p>
      ) : null}

      {!detailLoading &&
      !previewEvent &&
      showingDefaultUpcoming &&
      dayEvents.length === 0 ? (
        <DetailsEmptyState
          title="Select a day"
          description="Pick a date on the calendar to see the event."
        />
      ) : null}

      {detailLoading ? <DetailsSkeleton /> : null}

      {detailError ? (
        <p className="ds-field-error px-4 pb-4">{detailError}</p>
      ) : null}

      {previewEvent ? (
        <div key={previewEvent.id} className="details-panel-content">
          <div className="details-panel-body details-panel-body--dense">
            <header className="calendar-command-header">
              <h3 className="event-command-title">{previewEvent.name}</h3>
              <p className="event-command-meta" aria-label="Date, time, and location">
                {whenLine}
                {locationLine ? (
                  <>
                    <br />
                    {locationLine}
                  </>
                ) : null}
              </p>
              <p className="event-command-kicker">{EVENT_TYPE_LABELS[eventType]}</p>
            </header>

            <DetailsSection
              label="RSVP"
              aria-label="Your RSVP"
              className="details-panel-section--compact"
            >
              <EventRsvpSegmented
                currentStatus={
                  eventDetail?.current_member_rsvp_status ?? null
                }
                canRsvp={isEventUpcoming(
                  eventDetail?.starts_at ?? previewEvent.starts_at,
                )}
                loading={rsvpLoading || !eventDetail}
                onStatusChange={onRsvpStatusChange}
                counts={{
                  going: goingCount ?? 0,
                  maybe: maybeCount,
                  not_going: notGoingCount,
                }}
              />
            </DetailsSection>

            {canManage ? (
              <EventHealthCard
                preparationPct={preparationPct}
                checklistDone={checklistDone}
                checklistTotal={checklistTotal}
                overdueTasks={overdueTasks}
                budgetSpent={spentBudget}
                budgetCap={plannedBudget}
                volunteersFilled={volunteersFilled}
                volunteersNeeded={volunteersNeeded}
                volunteersTargetSet={volunteersTargetSet}
                manageEventId={manageEventId}
              />
            ) : null}

            <div className="mt-3.5 space-y-2" data-testid="event-attendees-row">
              {attendeeTotal > 0 ? (
                <>
                  <div className="event-command-section-head">
                    <h3 className="event-command-kicker">
                      {attendeeTotal} {attendeeTotal === 1 ? "attendee" : "attendees"}
                    </h3>
                  </div>
                  <EventAttendeeStack
                    attendees={stackAttendees}
                    totalCount={attendeeTotal}
                    maxVisible={AVATAR_STACK_MAX}
                    onViewAttendees={() =>
                      setAttendeesExpanded((value) => !value)
                    }
                    viewLabel={
                      attendeesExpanded ? "Hide attendees" : "View attendees"
                    }
                  />
                  {attendeesExpanded ? (
                    <ul className="details-panel-people-list">
                      {attendees.map((attendee) => (
                        <li key={attendee.member_id}>
                          <Avatar
                            name={attendee.full_name}
                            memberId={attendee.member_id}
                            size="sm"
                          />
                          <span>{attendee.full_name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>

            <DetailsActions className="details-panel-actions--dense">
              <Link
                to={eventDetailPath(previewEvent.id)}
                className="event-command-btn event-command-btn--primary w-full"
              >
                Open event
              </Link>
              {canManage && manageEventId != null ? (
                <Link
                  to={`/events/${manageEventId}/manage`}
                  className="event-command-btn w-full"
                >
                  Manage
                </Link>
              ) : null}
            </DetailsActions>
          </div>
        </div>
      ) : null}
    </DetailsPanel>
  );
}
