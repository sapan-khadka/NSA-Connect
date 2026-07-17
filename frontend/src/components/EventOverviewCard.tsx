/**
 * Calendar sidebar — dense inspector panel for the selected event.
 * Presentation only; RSVP / manage handlers unchanged.
 */

import {
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { useAuth } from "../context/useAuth";
import type { EventType } from "../lib/event-types";
import { eventDetailPath } from "../lib/event-links";
import { isEventUpcoming } from "../lib/event-rsvp";
import {
  filledNeededRoles,
  NEEDED_VOLUNTEER_ROLES,
} from "../lib/event-volunteer-summary";
import {
  fetchEventAttendees,
  fetchEventVolunteerSignups,
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
import { isRoleAtLeast } from "../lib/roles";
import {
  DetailsActions,
  DetailsEmptyState,
  DetailsHeader,
  DetailsMetadata,
  DetailsPanel,
  DetailsSection,
  DetailsSkeleton,
  detailsActionClass,
} from "./details-panel";
import { EventAttendeeStack } from "./EventAttendeeStack";
import { EventBanner } from "./EventBanner";
import { EventHealthCard } from "./EventHealthCard";
import {
  EventNeedsAttentionCard,
  type NeedsAttentionItem,
} from "./EventNeedsAttentionCard";
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

/** Compact nav date — e.g. "Tue, Jul 28" from YYYY-MM-DD or ISO datetime. */
function formatCompactNavDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
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
  const canManage = member ? isRoleAtLeast(member.role, "board") : false;
  const previewEvent =
    eventDetail ??
    dayEvents.find((event) => event.id === selectedEventId) ??
    dayEvents[0] ??
    null;
  const manageEventId = previewEvent?.id ?? selectedEventId;

  const [attendees, setAttendees] = useState<EventRsvpAttendee[]>([]);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const [taskStats, setTaskStats] = useState<{
    done: number;
    total: number;
    overdue: number;
  } | null>(null);
  const [budget, setBudget] = useState<FinanceEventBudgetSummary | null>(null);
  const [volunteersFilled, setVolunteersFilled] = useState(0);
  const [volunteersNeeded, setVolunteersNeeded] = useState(
    NEEDED_VOLUNTEER_ROLES.length,
  );

  useEffect(() => {
    setAttendeesExpanded(false);
  }, [previewEvent?.id]);

  useEffect(() => {
    if (!previewEvent) {
      setAttendees([]);
      setGoingCount(null);
      setTaskStats(null);
      setBudget(null);
      setVolunteersFilled(0);
      setVolunteersNeeded(NEEDED_VOLUNTEER_ROLES.length);
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
        setAttendees(
          response.attendees.filter((row) => row.rsvp_status === "going"),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAttendees([]);
          setGoingCount(null);
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

      void fetchEventVolunteerSignups(eventId)
        .then((response) => {
          if (cancelled) {
            return;
          }
          setVolunteersFilled(filledNeededRoles(response.signups).size);
          setVolunteersNeeded(NEEDED_VOLUNTEER_ROLES.length);
        })
        .catch(() => {
          if (!cancelled) {
            setVolunteersFilled(0);
            setVolunteersNeeded(NEEDED_VOLUNTEER_ROLES.length);
          }
        });
    } else {
      setTaskStats(null);
      setBudget(null);
      setVolunteersFilled(0);
      setVolunteersNeeded(NEEDED_VOLUNTEER_ROLES.length);
    }

    return () => {
      cancelled = true;
    };
  }, [previewEvent?.id, canManage]);

  const countdown = previewEvent
    ? formatEventCountdown(previewEvent.starts_at)
    : null;
  const eventType = (previewEvent?.event_type ?? "social") as EventType;
  const coverUrl = previewEvent?.event_photo_url?.trim() || null;

  const preparationPct =
    taskStats && taskStats.total > 0
      ? Math.round((taskStats.done / taskStats.total) * 100)
      : 0;

  const plannedBudget = budget ? Number(budget.planned_budget) || 0 : 0;
  const spentBudget = budget ? Number(budget.actual_expense) || 0 : 0;

  const attentionItems = useMemo((): NeedsAttentionItem[] => {
    if (!canManage) {
      return [];
    }
    const items: NeedsAttentionItem[] = [];
    if (taskStats && taskStats.overdue > 0) {
      items.push({
        id: "overdue-tasks",
        label:
          taskStats.overdue === 1
            ? "1 task overdue"
            : `${taskStats.overdue} tasks overdue`,
        severity: "urgent",
      });
    }
    if (plannedBudget > 0 && spentBudget > plannedBudget) {
      items.push({
        id: "budget-over",
        label: "Budget overspent",
        severity: "urgent",
      });
    }
    const volunteerShortfall = Math.max(
      0,
      volunteersNeeded - volunteersFilled,
    );
    if (volunteerShortfall > 0) {
      items.push({
        id: "volunteers-short",
        label:
          volunteerShortfall === 1
            ? "Need 1 more volunteer"
            : `Need ${volunteerShortfall} more volunteers`,
        severity: "pending",
      });
    }
    return items;
  }, [
    canManage,
    taskStats,
    plannedBudget,
    spentBudget,
    volunteersFilled,
    volunteersNeeded,
  ]);

  const stackAttendees = useMemo(
    () =>
      attendees.map((attendee) => ({
        id: attendee.member_id,
        name: attendee.full_name,
      })),
    [attendees],
  );

  const navDateValue =
    selectedDate ?? (previewEvent ? previewEvent.starts_at : null);
  const navDateLabel = navDateValue
    ? formatCompactNavDate(navDateValue)
    : null;
  const heroDate = previewEvent
    ? formatCompactNavDate(previewEvent.starts_at)
    : null;
  const heroTime = previewEvent
    ? formatClockRange(previewEvent.starts_at, previewEvent.ends_at)
    : null;
  const heroLocation = previewEvent?.location?.trim() || null;
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

  const metaItems = [
    heroDate
      ? { key: "date", icon: Calendar, value: heroDate }
      : null,
    heroTime ? { key: "time", icon: Clock, value: heroTime } : null,
    heroLocation
      ? { key: "location", icon: MapPin, value: heroLocation }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: typeof Calendar;
    value: string;
  }>;

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
          title="Select an event"
          description="Choose an event from the calendar to view details, RSVP information, preparation progress, budget, and attendees."
        />
      ) : null}

      {previewEvent ||
      showEmptyDay ||
      detailLoading ||
      detailError ||
      dayEvents.length > 1 ? (
        <DetailsHeader
          label={
            dayEvents.length > 1 ? (
              <ul className="details-panel-chips details-panel-chips--in-header">
                {dayEvents.map((event) => {
                  const isActive = event.id === selectedEventId;
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onSelectEvent(event.id)}
                        className={[
                          "details-panel-chip",
                          isActive ? "is-active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {event.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : showingDefaultUpcoming && !previewEvent ? (
              "Event details"
            ) : undefined
          }
          trailing={
            navDateLabel && previewEvent ? (
              <span className="details-panel-header-trailing-text">
                {navDateLabel}
              </span>
            ) : null
          }
        />
      ) : null}

      {showEmptyDay ? (
        <p className="details-panel-inline-empty px-4 pb-4">
          No events on this day.
        </p>
      ) : null}

      {!detailLoading &&
      !previewEvent &&
      showingDefaultUpcoming &&
      dayEvents.length === 0 ? (
        <DetailsEmptyState
          title="Select an event"
          description="Choose an event from the calendar to view details, RSVP information, preparation progress, budget, and attendees."
        />
      ) : null}

      {detailLoading ? <DetailsSkeleton /> : null}

      {detailError ? (
        <p className="ds-field-error px-4 pb-4">{detailError}</p>
      ) : null}

      {previewEvent ? (
        <div key={previewEvent.id} className="details-panel-content">
          <EventBanner
            eventType={eventType}
            imageUrl={coverUrl}
            countdown={countdown}
          />

          <div className="details-panel-body details-panel-body--dense">
            <h3 className="details-panel-event-title">{previewEvent.name}</h3>

            <DetailsMetadata
              aria-label="Date, time, and location"
              className="details-panel-meta--dense"
              items={metaItems}
            />

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
              />
            </DetailsSection>

            <div className="space-y-2" data-testid="event-attendees-row">
              {attendeeTotal > 0 ? (
                <>
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
                          <Avatar name={attendee.full_name} size="sm" />
                          <span>{attendee.full_name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="text-[12px] font-medium text-label">
                  0 attending
                </p>
              )}
            </div>

            {canManage ? (
              <details className="event-health-disclosure">
                <summary className="event-health-disclosure-summary">
                  Event health
                </summary>
                <div className="event-health-disclosure-body">
                  <EventHealthCard
                    preparationPct={preparationPct}
                    budgetSpent={spentBudget}
                    budgetCap={plannedBudget}
                    volunteersFilled={volunteersFilled}
                    volunteersNeeded={volunteersNeeded}
                    showHeading={false}
                    className="border-0 bg-transparent p-0"
                  />
                  <EventNeedsAttentionCard
                    items={attentionItems}
                    className="border-0 bg-transparent p-0"
                  />
                </div>
              </details>
            ) : null}

            <DetailsActions className="details-panel-actions--stack details-panel-actions--dense">
              <Link
                to={eventDetailPath(previewEvent.id)}
                className={detailsActionClass(
                  "primary",
                  "details-panel-btn--dominant w-full",
                )}
              >
                Open Workspace
              </Link>
              {canManage && manageEventId != null ? (
                <Link
                  to={`/events/${manageEventId}/manage`}
                  className={detailsActionClass(
                    "secondary",
                    "details-panel-btn--quiet w-full",
                  )}
                >
                  Manage Event
                </Link>
              ) : null}
            </DetailsActions>
          </div>
        </div>
      ) : null}
    </DetailsPanel>
  );
}
