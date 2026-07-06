import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EventCheckInPanel } from "../components/EventCheckInPanel";
import { EventAttendanceSummaryPanel } from "../components/EventAttendanceSummaryPanel";
import { EventDeleteSection } from "../components/EventDeleteSection";
import { EventInvitedParticipantsSection } from "../components/EventInvitedParticipantsSection";
import { EventVolunteersSection } from "../components/EventVolunteersSection";
import { EventFeedbackSection } from "../components/EventFeedbackSection";
import { EventManageLogisticsSection } from "../components/EventManageLogisticsSection";
import { EventManageScheduleFields } from "../components/EventManageScheduleFields";
import { EventMeetingVisibilitySetting } from "../components/EventMeetingVisibilitySetting";
import { EventPhotoArchiveSetting } from "../components/EventPhotoArchiveSetting";
import { MeetingRecordSection } from "../components/MeetingRecordSection";
import { canCreateEventTasks } from "../lib/event-finance";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchEvent, type EventDetailResponse } from "../lib/events-api";
import { fetchEventAttendanceSummary, type EventAttendanceSummary } from "../lib/event-checkin-api";
import { fetchEventTasks, type EventTaskResponse } from "../lib/event-tasks-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { fetchAssignableMembers } from "../lib/members-api";
import { fetchEventBudgetForEvent } from "../lib/finance-api";
import type { MemberResponse } from "../lib/auth-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  buildVolunteerTaskDraft,
  type EventTaskDraft,
} from "../lib/event-task-draft";
import {
  canManageEventTasks,
  isRoleAtLeast,
} from "../lib/roles";

type ManageTab = "meeting" | "logistics";

export function EventManagePage() {
  const { eventId } = useParams();
  const numericEventId = Number(eventId);
  const { member } = useAuth();

  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [budget, setBudget] = useState<FinanceEventBudgetSummary | null>(null);
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [assignableMembers, setAssignableMembers] = useState<MemberResponse[]>(
    [],
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ManageTab>("meeting");
  const [attendanceSummary, setAttendanceSummary] =
    useState<EventAttendanceSummary | null>(null);
  const [taskDraft, setTaskDraft] = useState<EventTaskDraft | null>(null);

  const canViewBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const canViewTreasury = member ? isRoleAtLeast(member.role, "treasurer") : false;
  const canManageTasks = member
    ? canManageEventTasks(member.role, member.position)
    : false;
  const isMeetingEvent = event?.event_type === "meeting";

  useEffect(() => {
    if (!Number.isFinite(numericEventId)) {
      setError("Invalid event.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [eventDetail, taskResponse] = await Promise.all([
          fetchEvent(numericEventId),
          canViewBoard
            ? fetchEventTasks(numericEventId)
            : Promise.resolve({ tasks: [], total: 0 }),
        ]);

        let budgetSummary: FinanceEventBudgetSummary | null = null;
        if (canViewBoard) {
          try {
            budgetSummary = await fetchEventBudgetForEvent(numericEventId);
          } catch {
            budgetSummary = null;
          }
        }

        if (!cancelled) {
          setEvent(eventDetail);
          setTasks(taskResponse.tasks);
          setBudget(budgetSummary);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [numericEventId, canViewBoard, refreshKey]);

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
    if (!canViewBoard || !Number.isFinite(numericEventId)) {
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
  }, [canViewBoard, numericEventId, refreshKey]);

  if (isLoading) {
    return <p className="text-sm text-label">Loading event…</p>;
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <Link to="/events/calendar" className="ds-link">
          ← Back to calendar
        </Link>
        <div role="alert" className="ds-alert-banner p-6">
          {error ?? "Event not found."}
        </div>
      </div>
    );
  }

  const logisticsSection = (
    <EventManageLogisticsSection
      event={event}
      budget={budget}
      tasks={tasks}
      member={member}
      canViewBoard={canViewBoard}
      canViewTreasury={canViewTreasury}
      canManageTasks={canManageTasks}
      assignableMembers={assignableMembers}
      refreshKey={refreshKey}
      onRefresh={() => setRefreshKey((current) => current + 1)}
      taskDraft={taskDraft}
      onTaskDraftApplied={() => setTaskDraft(null)}
    />
  );

  function handleConvertVolunteerToTask(
    signup: Parameters<typeof buildVolunteerTaskDraft>[1],
  ) {
    if (!event) {
      return;
    }

    if (isMeetingEvent) {
      setActiveTab("logistics");
    }

    setTaskDraft(buildVolunteerTaskDraft(event.name, signup));

    window.requestAnimationFrame(() => {
      document
        .getElementById("event-tasks-section")
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/events/calendar" className="ds-link">
          ← Back to calendar
        </Link>
      </div>

      <section className="ds-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-light tracking-headline text-foreground">
            {event.name}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
          >
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
        </div>
        <p className="mt-2 text-label">{formatEventDateTime(event.starts_at)}</p>
        {!isMeetingEvent && event.description ? (
          <p className="mt-4 text-sm leading-relaxed text-foreground">
            {event.description}
          </p>
        ) : null}
      </section>

      {canViewBoard ? (
        <>
          <EventManageScheduleFields event={event} onUpdated={setEvent} />
          {isMeetingEvent ? (
            <EventMeetingVisibilitySetting
              event={event}
              onUpdated={setEvent}
            />
          ) : null}
          <EventPhotoArchiveSetting
            event={event}
            onUpdated={setEvent}
          />
          <EventVolunteersSection
            eventId={numericEventId}
            refreshKey={refreshKey}
            eventName={event.name}
            canAssignTasks={canManageTasks && canCreateEventTasks(event)}
            onConvertToTask={handleConvertVolunteerToTask}
          />
          {event.is_past ? (
            <EventFeedbackSection
              eventId={numericEventId}
              eventName={event.name}
              refreshKey={refreshKey}
            />
          ) : null}
        </>
      ) : null}

      {isMeetingEvent ? (
        <>
          <nav
            aria-label="Event manage sections"
            className="border-b border-gray-200"
          >
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("meeting")}
                className={[
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === "meeting"
                    ? "border-accent text-accent"
                    : "border-transparent text-label hover:text-accent",
                ].join(" ")}
              >
                Meeting
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logistics")}
                className={[
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === "logistics"
                    ? "border-accent text-accent"
                    : "border-transparent text-label hover:text-accent",
                ].join(" ")}
              >
                Logistics
              </button>
            </div>
          </nav>

          {activeTab === "meeting" ? (
            <MeetingRecordSection
              eventId={numericEventId}
              eventName={event.name}
            />
          ) : (
            logisticsSection
          )}
        </>
      ) : (
        logisticsSection
      )}

      {canViewBoard ? (
        <EventInvitedParticipantsSection
          eventId={numericEventId}
          refreshKey={refreshKey}
        />
      ) : null}

      {canViewBoard ? (
        <EventCheckInPanel eventId={numericEventId} eventName={event.name} />
      ) : null}

      {canViewBoard && attendanceSummary ? (
        <EventAttendanceSummaryPanel summary={attendanceSummary} />
      ) : null}

      {canViewBoard ? (
        <EventDeleteSection eventId={numericEventId} eventName={event.name} />
      ) : null}
    </div>
  );
}
