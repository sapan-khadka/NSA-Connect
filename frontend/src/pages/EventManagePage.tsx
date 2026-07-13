import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EventManageDashboard } from "../components/EventManageDashboard";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { calendarDeepLink } from "../lib/event-links";
import {
  fetchEventAttendanceSummary,
  type EventAttendanceSummary,
} from "../lib/event-checkin-api";
import { fetchEvent, type EventDetailResponse } from "../lib/events-api";
import type { EventVolunteerSignupMember } from "../lib/events-api";
import { fetchEventTasks, type EventTaskResponse } from "../lib/event-tasks-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { fetchAssignableMembers } from "../lib/members-api";
import {
  fetchEventBudgetForEvent,
  type FinanceEventBudgetSummary,
} from "../lib/finance-api";
import type { MemberResponse } from "../lib/auth-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  buildVolunteerTaskDraft,
  type EventTaskDraft,
} from "../lib/event-task-draft";
import {
  canManageEventTasks,
  canManageTreasury,
  isRoleAtLeast,
} from "../lib/roles";

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
  const [attendanceSummary, setAttendanceSummary] =
    useState<EventAttendanceSummary | null>(null);
  const [taskDraft, setTaskDraft] = useState<EventTaskDraft | null>(null);
  const [openTasksModalToken, setOpenTasksModalToken] = useState(0);

  const canViewBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const canViewTreasury = member
    ? canManageTreasury(member.role, member.position)
    : false;
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
    const calendarBackTo = Number.isFinite(numericEventId)
      ? `/events/calendar?event=${numericEventId}`
      : "/events/calendar";

    return (
      <div className="space-y-4">
        <Link to={calendarBackTo} className="ds-link">
          ← Back to calendar
        </Link>
        <div role="alert" className="ds-alert-banner p-6">
          {error ?? "Event not found."}
        </div>
      </div>
    );
  }

  const calendarBackTo = calendarDeepLink(event);

  function handleConvertVolunteerToTask(signup: EventVolunteerSignupMember) {
    setTaskDraft(buildVolunteerTaskDraft(event.name, signup));
    setOpenTasksModalToken((current) => current + 1);
  }

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
      <div>
        <Link to={calendarBackTo} className="ds-link">
          ← Back to calendar
        </Link>
      </div>

      <Card padding="none" className="p-4 sm:p-5 home-surface-quiet">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-light tracking-headline text-foreground sm:text-3xl">
            {event.name}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
          >
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-label">
          {formatEventDateTime(event.starts_at)}
        </p>
        {!isMeetingEvent && event.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground">
            {event.description}
          </p>
        ) : null}
      </Card>

      <EventManageDashboard
        event={event}
        budget={budget}
        tasks={tasks}
        member={member}
        canViewBoard={canViewBoard}
        canViewTreasury={canViewTreasury}
        canManageTasks={canManageTasks}
        assignableMembers={assignableMembers}
        refreshKey={refreshKey}
        attendanceSummary={attendanceSummary}
        taskDraft={taskDraft}
        onUpdated={setEvent}
        onRefresh={handleRefresh}
        onTaskDraftApplied={() => setTaskDraft(null)}
        onConvertVolunteerToTask={handleConvertVolunteerToTask}
        openTasksModalToken={openTasksModalToken}
      />
    </div>
  );
}
