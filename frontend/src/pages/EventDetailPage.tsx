import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EventAttendeesPanel } from "../components/EventAttendeesPanel";
import { EventAttendanceSummaryPanel } from "../components/EventAttendanceSummaryPanel";
import { DiscussionFeed } from "../components/DiscussionFeed";
import { canCreateEventTasks } from "../lib/event-finance";
import { EventFinanceCloseoutBanner } from "../components/EventFinanceCloseoutBanner";
import { EventRsvpButton } from "../components/EventRsvpButton";
import { EventVolunteerRolesPanel } from "../components/EventVolunteerRolesPanel";
import { EventVolunteerSignupPanel } from "../components/EventVolunteerSignupPanel";
import { EventFeedbackPanel } from "../components/EventFeedbackPanel";
import { EventTaskManager } from "../components/EventTaskManager";
import { ArrowLink } from "../components/ui/ArrowLink";
import { HomeCard } from "../components/ui/HomeCard";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { calendarDeepLink } from "../lib/event-links";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { applyRsvpStatus, isEventUpcoming } from "../lib/event-rsvp";
import {
  fetchEvent,
  fetchEventAttendees,
  updateEventRsvp,
  type EventAttendeesResponse,
  type EventDetailResponse,
  type RsvpStatus,
} from "../lib/events-api";
import {
  fetchEventAttendanceSummary,
  type EventAttendanceSummary,
} from "../lib/event-checkin-api";
import { fetchAssignableMembers } from "../lib/members-api";
import type { MemberResponse } from "../lib/auth-api";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  canManageEventTasks,
  isRoleAtLeast,
} from "../lib/roles";

import { fetchMyEventTasks } from "../lib/event-tasks-api";

export function EventDetailPage() {
  const { eventId } = useParams();
  const numericEventId = Number(eventId);
  const { member } = useAuth();

  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [assignableMembers, setAssignableMembers] = useState<MemberResponse[]>(
    [],
  );
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendeesResponse | null>(
    null,
  );
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState<string | null>(null);
  const [attendanceSummary, setAttendanceSummary] =
    useState<EventAttendanceSummary | null>(null);
  const [hasMyTasksForEvent, setHasMyTasksForEvent] = useState(false);

  const canViewBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const canManageTasks = member
    ? canManageEventTasks(member.role, member.position)
    : false;
  const isGeneralMember = member?.role === "general";
  const showTasksExpanded =
    canManageTasks ||
    canViewBoard ||
    !isGeneralMember ||
    hasMyTasksForEvent;

  const loadEvent = useCallback(async () => {
    if (!Number.isFinite(numericEventId)) {
      setError("Invalid event.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detail = await fetchEvent(numericEventId);
      setEvent(detail);
      setTaskRefreshKey((current) => current + 1);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setEvent(null);
    } finally {
      setIsLoading(false);
    }
  }, [numericEventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const loadAttendees = useCallback(async () => {
    if (!Number.isFinite(numericEventId) || !canViewBoard) {
      setAttendees(null);
      return;
    }

    setAttendeesLoading(true);
    setAttendeesError(null);

    try {
      const response = await fetchEventAttendees(numericEventId);
      setAttendees(response);
    } catch {
      setAttendees(null);
      setAttendeesError("Could not load attendee list.");
    } finally {
      setAttendeesLoading(false);
    }
  }, [canViewBoard, numericEventId]);

  useEffect(() => {
    void loadAttendees();
  }, [loadAttendees]);

  useEffect(() => {
    if (!canViewBoard || !event?.is_past || !Number.isFinite(numericEventId)) {
      setAttendanceSummary(null);
      return;
    }

    let cancelled = false;

    async function loadSummary() {
      try {
        const summary = await fetchEventAttendanceSummary(numericEventId);
        if (!cancelled) {
          setAttendanceSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setAttendanceSummary(null);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [canViewBoard, event?.is_past, numericEventId]);

  useEffect(() => {
    if (!canManageTasks) {
      setAssignableMembers([]);
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      try {
        const response = await fetchAssignableMembers();
        if (!cancelled) {
          setAssignableMembers(response.members);
        }
      } catch {
        if (!cancelled) {
          setAssignableMembers([]);
        }
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [canManageTasks]);

  useEffect(() => {
    if (!isGeneralMember || !Number.isFinite(numericEventId)) {
      setHasMyTasksForEvent(false);
      return;
    }

    let cancelled = false;

    async function loadMyTasks() {
      try {
        const response = await fetchMyEventTasks();
        if (!cancelled) {
          setHasMyTasksForEvent(
            response.tasks.some((task) => task.event_id === numericEventId),
          );
        }
      } catch {
        if (!cancelled) {
          setHasMyTasksForEvent(false);
        }
      }
    }

    void loadMyTasks();

    return () => {
      cancelled = true;
    };
  }, [isGeneralMember, numericEventId, taskRefreshKey]);

  async function handleRsvpStatusChange(status: RsvpStatus) {
    if (!event) {
      return;
    }

    const snapshot = event;
    setRsvpLoading(true);
    setEvent((current) =>
      current
        ? { ...current, current_member_rsvp_status: status }
        : current,
    );

    try {
      const response = await updateEventRsvp(event.id, status);
      setEvent((current) =>
        current ? applyRsvpStatus(current, response) : current,
      );
      if (canViewBoard) {
        void loadAttendees();
      }
    } catch (caught) {
      setEvent(snapshot);
      const detail = (caught as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const atCapacity =
        typeof detail === "object" &&
        detail !== null &&
        "code" in detail &&
        (detail as { code?: string }).code === "event_at_capacity";
      if (atCapacity && status === "going") {
        const joinWaitlist = window.confirm(
          "This event is at capacity. Join the waitlist instead?",
        );
        if (joinWaitlist) {
          void handleRsvpStatusChange("waitlisted");
          return;
        }
      }
    } finally {
      setRsvpLoading(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-label">Loading event…</p>;
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <Link to="/" className="ds-link">
          ← Back to home
        </Link>
        <div
          role="alert"
          className="ds-alert-banner p-6"
        >
          {error ?? "Event not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="ds-link">
          ← Back to home
        </Link>
        <ArrowLink to={calendarDeepLink(event)}>View on calendar</ArrowLink>
      </div>

      <HomeCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-light tracking-headline text-foreground">{event.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
              >
                {EVENT_TYPE_LABELS[event.event_type]}
              </span>
            </div>
            <p className="text-label">{formatEventDateTime(event.starts_at)}</p>
            <p className="text-sm text-label">
              <span className="font-medium text-foreground">Location: </span>
              {event.location?.trim() ? event.location : "Not specified"}
            </p>
            {canViewBoard ? (
              <p className="text-sm text-label">
                <span className="font-medium text-foreground">
                  Budget allocated:{" "}
                </span>
                {formatCurrency(event.budget)}
              </p>
            ) : null}
          </div>
          {canViewBoard ? (
            <Link
              to={`/events/${event.id}/manage`}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            >
              Manage event
            </Link>
          ) : null}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-foreground">
          {event.description}
        </p>

        <div className="mt-5">
          {event.current_member_is_invited_participant ? (
            <p className="mb-3 inline-flex rounded-full bg-[#EEF4FF] px-3 py-1 text-sm text-[#1B4B8A]">
              You&apos;ve been invited to participate
            </p>
          ) : null}
          <EventRsvpButton
            currentStatus={event.current_member_rsvp_status}
            canRsvp={isEventUpcoming(event.starts_at)}
            loading={rsvpLoading}
            atCapacity={event.current_member_rsvp_status === "waitlisted"}
            onStatusChange={(status) => void handleRsvpStatusChange(status)}
          />
          <div className="mt-3 space-y-3">
            <EventVolunteerRolesPanel
              eventId={event.id}
              canVolunteer={isEventUpcoming(event.starts_at)}
            />
            <EventVolunteerSignupPanel
              eventId={event.id}
              canVolunteer={isEventUpcoming(event.starts_at)}
              signup={event.current_member_volunteer_signup}
              onSignupChange={(signup) =>
                setEvent((current) =>
                  current
                    ? { ...current, current_member_volunteer_signup: signup }
                    : current,
                )
              }
            />
          </div>
          <div className="mt-3">
            <EventFeedbackPanel
              eventId={event.id}
              canSubmitFeedback={!isEventUpcoming(event.starts_at)}
              feedback={event.current_member_feedback}
              onFeedbackChange={(feedback) =>
                setEvent((current) =>
                  current
                    ? { ...current, current_member_feedback: feedback }
                    : current,
                )
              }
            />
          </div>
        </div>

        {event.event_type === "meeting" && canViewBoard ? (
          <div className="mt-4">
            <ArrowLink to={`/events/meetings/${event.id}`}>
              View meeting record
            </ArrowLink>
          </div>
        ) : null}
      </HomeCard>

      {canViewBoard || event.current_member_volunteer_signup ? (
        <DiscussionFeed
          title="Discussion"
          description={
            canViewBoard
              ? "Board members and volunteers for this event can post here."
              : "Volunteers for this event can post here."
          }
          scope={{ type: "event", eventId: event.id }}
        />
      ) : null}

      {canViewBoard ? (
        <HomeCard>
          <EventAttendeesPanel
            eventName={event.name}
            data={attendees}
            loading={attendeesLoading}
            error={attendeesError}
          />
        </HomeCard>
      ) : null}

      {canViewBoard && event.is_past && attendanceSummary ? (
        <EventAttendanceSummaryPanel summary={attendanceSummary} />
      ) : null}

      <EventFinanceCloseoutBanner event={event} />

      <HomeCard>
        {showTasksExpanded ? (
          <EventTaskManager
            key={`${event.id}-${taskRefreshKey}`}
            eventId={event.id}
            eventName={event.name}
            member={member}
            canManageSimple={canManageTasks}
            canCreateTasks={canCreateEventTasks(event)}
            canAssignChecklist={canViewBoard}
            assignableMembers={assignableMembers}
            fallbackChecklistTasks={event.prep_tasks}
            onFallbackTasksChange={(tasks) =>
              setEvent((current) =>
                current ? { ...current, prep_tasks: tasks } : current,
              )
            }
            refreshKey={taskRefreshKey}
          />
        ) : (
          <details
            className="rounded-lg border border-gray-200 bg-surface-muted/40 p-3"
            open={hasMyTasksForEvent || undefined}
          >
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              {hasMyTasksForEvent ? "Your assigned tasks" : "Tasks & volunteer"}
            </summary>
            <div className="mt-3 space-y-3">
              {hasMyTasksForEvent ? (
                <p className="text-sm text-label">
                  Update status here or on{" "}
                  <Link
                    to="/events/tasks"
                    className="font-medium text-accent hover:underline"
                  >
                    My tasks
                  </Link>{" "}
                  for the full board view.
                </p>
              ) : null}
              <EventTaskManager
                key={`${event.id}-${taskRefreshKey}`}
                eventId={event.id}
                eventName={event.name}
                member={member}
                canManageSimple={canManageTasks}
                canCreateTasks={canCreateEventTasks(event)}
                canAssignChecklist={canViewBoard}
                assignableMembers={assignableMembers}
                fallbackChecklistTasks={event.prep_tasks}
                onFallbackTasksChange={(tasks) =>
                  setEvent((current) =>
                    current ? { ...current, prep_tasks: tasks } : current,
                  )
                }
                refreshKey={taskRefreshKey}
              />
            </div>
          </details>
        )}
      </HomeCard>
    </div>
  );
}
