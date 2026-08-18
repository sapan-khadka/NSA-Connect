import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { EventAttendeesPanel } from "../components/EventAttendeesPanel";
import { EventAttendanceSummaryPanel } from "../components/EventAttendanceSummaryPanel";
import { DiscussionFeed } from "../components/DiscussionFeed";
import { canCreateEventTasks } from "../lib/event-finance";
import { EventFinanceCloseoutBanner } from "../components/EventFinanceCloseoutBanner";
import { EventBanner } from "../components/EventBanner";
import { EventRsvpButton } from "../components/EventRsvpButton";
import { EventVolunteerRolesPanel } from "../components/EventVolunteerRolesPanel";
import { EventVolunteerSignupPanel } from "../components/EventVolunteerSignupPanel";
import { EventFeedbackPanel } from "../components/EventFeedbackPanel";
import { EventTaskManager } from "../components/EventTaskManager";
import { formatEventCountdown } from "../components/EventOverviewCard";
import { ArrowLink } from "../components/ui/ArrowLink";
import { PageBackLink } from "../components/ui/PageBackLink";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { calendarDeepLink } from "../lib/event-links";
import { formatEventCommandWhen } from "../lib/event-manage-command";
import { EVENT_TYPE_LABELS } from "../lib/event-types";
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
import {
  canManageEventTasks,
  memberSatisfiesMinRole,
} from "../lib/roles";

import { fetchMyEventTasks } from "../lib/event-tasks-api";

export function EventDetailPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const numericEventId = Number(eventId);
  const { member } = useAuth();
  const invitedToVolunteer = searchParams.get("volunteer") === "1";

  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [hasVolunteerRoles, setHasVolunteerRoles] = useState(false);
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

  const canViewBoard = member ? memberSatisfiesMinRole(member, "board") : false;
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
    return <p className="event-command-stat">Loading event…</p>;
  }

  if (error || !event) {
    return (
      <div className="event-page event-command">
        <PageBackLink to="/events/calendar" label="Events" />
        <div role="alert" className="event-command-stat">
          {error ?? "Event not found."}
        </div>
      </div>
    );
  }

  const countdown = formatEventCountdown(event.starts_at);
  const metaLine = formatEventCommandWhen(event.starts_at, event.location);

  return (
    <div className="event-page event-command">
      <div className="event-page-nav">
        <PageBackLink to="/events/calendar" label="Events" historyFirst />
        <ArrowLink to={calendarDeepLink(event)}>View on calendar</ArrowLink>
      </div>

      <header className="event-command-header">
        <EventBanner
          eventType={event.event_type}
          imageUrl={event.event_photo_url}
          countdown={countdown}
          className="event-page-hero"
        />

        <div className="event-command-title-row">
          <div className="min-w-0">
            <p className="event-command-kicker">
              {EVENT_TYPE_LABELS[event.event_type]}
            </p>
            <h1 className="event-command-title">{event.name}</h1>
            <p className="event-command-meta">{metaLine}</p>
          </div>
          {canViewBoard ? (
            <Link
              to={`/events/${event.id}/manage`}
              className="event-command-btn event-command-btn--primary"
            >
              Manage Event
            </Link>
          ) : null}
        </div>

        {event.description?.trim() ? (
          <p className="event-page-description">{event.description}</p>
        ) : null}
      </header>

      <div className="event-page-body">
        <div className="event-command-split event-page-actions">
          <section
            className="event-command-section is-flush"
            aria-label="Your RSVP"
          >
            <div className="event-command-section-head">
              <h2 className="event-command-kicker">RSVP</h2>
            </div>
            {invitedToVolunteer || event.current_member_is_invited_participant ? (
              <p className="event-command-stat event-page-invite">
                {invitedToVolunteer
                  ? "You've been invited to volunteer. Claim a role below."
                  : "You've been invited to participate."}
              </p>
            ) : null}
            <EventRsvpButton
              currentStatus={event.current_member_rsvp_status}
              canRsvp={isEventUpcoming(event.starts_at)}
              loading={rsvpLoading}
              atCapacity={event.current_member_rsvp_status === "waitlisted"}
              onStatusChange={(status) => void handleRsvpStatusChange(status)}
              variant="segmented"
              embedded
            />
          </section>

          <section
            className="event-command-section is-flush"
            id="volunteer-roles"
            aria-label="Volunteer"
          >
            <EventVolunteerRolesPanel
              eventId={event.id}
              canVolunteer={isEventUpcoming(event.starts_at)}
              onSlotsLoaded={(count) => setHasVolunteerRoles(count > 0)}
            />
            {!hasVolunteerRoles || event.current_member_volunteer_signup ? (
              <EventVolunteerSignupPanel
                eventId={event.id}
                canVolunteer={isEventUpcoming(event.starts_at)}
                signup={event.current_member_volunteer_signup}
                hideHeading={hasVolunteerRoles}
                onSignupChange={(signup) =>
                  setEvent((current) =>
                    current
                      ? { ...current, current_member_volunteer_signup: signup }
                      : current,
                  )
                }
              />
            ) : (
              <details className="event-page-disclosure">
                <summary>Can't claim a role? Leave a note</summary>
                <div className="event-page-disclosure-body">
                  <EventVolunteerSignupPanel
                    eventId={event.id}
                    canVolunteer={isEventUpcoming(event.starts_at)}
                    signup={event.current_member_volunteer_signup}
                    hideHeading
                    onSignupChange={(signup) =>
                      setEvent((current) =>
                        current
                          ? {
                              ...current,
                              current_member_volunteer_signup: signup,
                            }
                          : current,
                      )
                    }
                  />
                </div>
              </details>
            )}
          </section>
        </div>

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

        {event.event_type === "meeting" && canViewBoard ? (
          <div className="event-command-section">
            <ArrowLink to={`/events/meetings/${event.id}`}>
              View meeting record
            </ArrowLink>
          </div>
        ) : null}

        <EventFinanceCloseoutBanner event={event} />

        {showTasksExpanded ? (
          <section className="event-command-section" aria-label="Tasks">
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
          </section>
        ) : (
          <details className="event-page-disclosure event-command-section">
            <summary>
              {hasMyTasksForEvent ? "Your assigned tasks" : "Tasks"}
            </summary>
            <div className="event-page-disclosure-body">
              {hasMyTasksForEvent ? (
                <p className="event-command-stat">
                  Update status here or on{" "}
                  <Link to="/events/tasks" className="event-page-inline-link">
                    My tasks
                  </Link>
                  .
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

        {canViewBoard || event.current_member_volunteer_signup ? (
          <section className="event-command-section" aria-label="Discussion">
            <DiscussionFeed
              title="Discussion"
              description={
                canViewBoard
                  ? "Board members and volunteers for this event can post here."
                  : "Volunteers for this event can post here."
              }
              scope={{ type: "event", eventId: event.id }}
              className="event-page-discussion"
            />
          </section>
        ) : null}

        {canViewBoard ? (
          <section className="event-command-section" aria-label="Attendees">
            <EventAttendeesPanel
              eventName={event.name}
              data={attendees}
              loading={attendeesLoading}
              error={attendeesError}
            />
          </section>
        ) : null}

        {canViewBoard && event.is_past && attendanceSummary ? (
          <section className="event-command-section">
            <EventAttendanceSummaryPanel summary={attendanceSummary} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
