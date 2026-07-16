/**
 * Calendar sidebar — dense inspector panel for the selected event.
 * Presentation only; RSVP / manage handlers unchanged.
 */

import {
  Calendar,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { useAuth } from "../context/useAuth";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABELS,
  type EventType,
} from "../lib/event-types";
import { eventDetailPath } from "../lib/event-links";
import { isEventUpcoming } from "../lib/event-rsvp";
import {
  fetchEventAttendees,
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
import { formatCurrency } from "../lib/format-currency";
import type { ManageLocationState } from "../lib/event-manage-navigation";
import { isRoleAtLeast } from "../lib/roles";
import {
  DetailsActions,
  DetailsEmptyState,
  DetailsHeader,
  DetailsHero,
  DetailsMetadata,
  DetailsPanel,
  DetailsProgress,
  DetailsSection,
  DetailsSkeleton,
  detailsActionClass,
} from "./details-panel";
import { EventRsvpButton } from "./EventRsvpButton";
import { Badge } from "./ui/Badge";

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

function manageLinkState(
  modal: NonNullable<ManageLocationState["openManageModal"]>,
): ManageLocationState {
  return { openManageModal: modal };
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
  /** Clear calendar selection / return to empty sidebar. */
  onBackToUpcoming: () => void;
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
  onBackToUpcoming,
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
  } | null>(null);
  const [budget, setBudget] = useState<FinanceEventBudgetSummary | null>(null);

  useEffect(() => {
    setAttendeesExpanded(false);
  }, [previewEvent?.id]);

  useEffect(() => {
    if (!previewEvent) {
      setAttendees([]);
      setGoingCount(null);
      setTaskStats(null);
      setBudget(null);
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
          setTaskStats({ done, total: response.tasks.length });
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
    } else {
      setTaskStats(null);
      setBudget(null);
    }

    return () => {
      cancelled = true;
    };
  }, [previewEvent?.id, canManage]);

  const countdown = previewEvent
    ? formatEventCountdown(previewEvent.starts_at)
    : null;
  const eventType = (previewEvent?.event_type ?? "social") as EventType;
  const heroColor = EVENT_TYPE_COLOR[eventType];

  const visibleAttendees = useMemo(
    () => attendees.slice(0, AVATAR_STACK_MAX),
    [attendees],
  );
  const overflowCount = Math.max(
    0,
    (goingCount ?? attendees.length) - visibleAttendees.length,
  );

  const taskPercent =
    taskStats && taskStats.total > 0
      ? Math.round((taskStats.done / taskStats.total) * 100)
      : 0;

  const plannedBudget = budget ? Number(budget.planned_budget) || 0 : 0;
  const spentBudget = budget ? Number(budget.actual_expense) || 0 : 0;
  const remainingBudget = budget ? Number(budget.budget_remaining) || 0 : 0;
  const budgetPercent =
    plannedBudget > 0
      ? Math.min(100, Math.round((spentBudget / plannedBudget) * 100))
      : 0;

  const showProgress = canManage && (taskStats != null || budget != null);

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

  const coverUrl = previewEvent?.event_photo_url?.trim() || null;
  const hasCoverImage = Boolean(coverUrl);

  const metaItems = [
    heroDate
      ? { key: "date", icon: Calendar, value: heroDate }
      : null,
    heroTime ? { key: "time", icon: Clock, value: heroTime } : null,
    heroLocation
      ? { key: "location", icon: MapPin, value: heroLocation }
      : null,
    goingCount != null
      ? { key: "attending", icon: Users, value: `${goingCount} attending` }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: typeof Calendar;
    value: string;
  }>;

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
          backLabel={
            previewEvent || showEmptyDay || dayEvents.length > 1
              ? "Calendar"
              : undefined
          }
          backAriaLabel="Clear selection"
          onBack={
            previewEvent || showEmptyDay || dayEvents.length > 1
              ? onBackToUpcoming
              : undefined
          }
          label={
            showingDefaultUpcoming && !previewEvent ? "Event details" : undefined
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

      {dayEvents.length > 1 ? (
        <ul className="details-panel-chips">
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
      ) : null}

      {detailLoading ? <DetailsSkeleton /> : null}

      {detailError ? (
        <p className="ds-field-error px-4 pb-4">{detailError}</p>
      ) : null}

      {previewEvent ? (
        <div key={previewEvent.id} className="details-panel-content">
          {hasCoverImage ? (
            <DetailsHero
              variant="banner"
              imageUrl={coverUrl}
              badges={
                <span className="details-panel-hero-badge">
                  {EVENT_TYPE_LABELS[eventType]}
                </span>
              }
              badgeEnd={
                countdown ? (
                  <span className="details-panel-hero-badge">{countdown}</span>
                ) : null
              }
            />
          ) : (
            <DetailsHero
              className="details-panel-hero--compact"
              title={previewEvent.name}
              fallbackStyle={{
                background: `linear-gradient(145deg, ${heroColor} 0%, color-mix(in srgb, ${heroColor} 45%, #111) 100%)`,
              }}
              badges={
                <>
                  <Badge variant="primary" size="sm">
                    {EVENT_TYPE_LABELS[eventType]}
                  </Badge>
                  {countdown ? (
                    <span className="details-panel-hero-badge">{countdown}</span>
                  ) : null}
                </>
              }
            />
          )}

          <div className="details-panel-body details-panel-body--dense">
            {hasCoverImage ? (
              <h3 className="details-panel-event-title">{previewEvent.name}</h3>
            ) : null}

            <DetailsMetadata
              aria-label="Event details"
              className="details-panel-meta--dense"
              items={metaItems}
            />

            {showProgress ? (
              <DetailsSection
                label="Project Status"
                aria-label="Project Status"
                className="details-panel-section--status details-panel-section--status-dense"
              >
                {taskStats ? (
                  <DetailsProgress
                    to={`/events/${previewEvent.id}/manage`}
                    state={manageLinkState("tasks")}
                    label="Preparation"
                    valueLabel={
                      taskStats.total === 0
                        ? "No tasks"
                        : `${taskStats.done}/${taskStats.total} · ${taskPercent}%`
                    }
                    percent={taskStats.total > 0 ? taskPercent : 0}
                    aria-label="Preparation progress"
                  />
                ) : null}

                {budget ? (
                  <DetailsProgress
                    to={`/events/${previewEvent.id}/manage`}
                    state={manageLinkState("transactions")}
                    label="Budget"
                    valueLabel={`${formatCurrency(spentBudget)} / ${formatCurrency(plannedBudget)} · ${formatCurrency(remainingBudget)} left`}
                    percent={budgetPercent}
                    aria-label="Budget spent"
                  />
                ) : null}
              </DetailsSection>
            ) : null}

            <DetailsActions className="details-panel-actions--dense">
              <Link
                to={eventDetailPath(previewEvent.id)}
                className={detailsActionClass("primary", "details-panel-btn--dominant")}
              >
                View Event
              </Link>
              {canManage && manageEventId != null ? (
                <Link
                  to={`/events/${manageEventId}/manage`}
                  className={detailsActionClass("secondary", "details-panel-btn--quiet")}
                >
                  Manage
                </Link>
              ) : null}
            </DetailsActions>

            {eventDetail ? (
              <DetailsSection
                label="RSVP"
                aria-label="Your RSVP"
                className="details-panel-section--compact"
              >
                <EventRsvpButton
                  currentStatus={eventDetail.current_member_rsvp_status}
                  canRsvp={isEventUpcoming(eventDetail.starts_at)}
                  loading={rsvpLoading}
                  onStatusChange={onRsvpStatusChange}
                  embedded
                  variant="segmented"
                />
              </DetailsSection>
            ) : null}

            {goingCount != null && goingCount > 0 ? (
              <div
                className="details-panel-attendees-inline"
                aria-label={`${goingCount} attending`}
              >
                <div className="details-panel-avatar-stack" aria-hidden="true">
                  {visibleAttendees.map((attendee, index) => (
                    <span
                      key={attendee.member_id}
                      className="details-panel-avatar-wrap"
                      style={{ zIndex: AVATAR_STACK_MAX - index }}
                    >
                      <Avatar name={attendee.full_name} size="sm" />
                    </span>
                  ))}
                  {overflowCount > 0 ? (
                    <span className="details-panel-avatar-overflow">
                      +{overflowCount}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="details-panel-text-action"
                  aria-expanded={attendeesExpanded}
                  aria-label={
                    attendeesExpanded
                      ? "Hide full attendee list"
                      : "Show full attendee list"
                  }
                  onClick={() => setAttendeesExpanded((value) => !value)}
                >
                  {attendeesExpanded ? "Hide" : "View attendees →"}
                </button>
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
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </DetailsPanel>
  );
}
