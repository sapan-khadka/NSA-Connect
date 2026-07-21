import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { EventManageDashboard } from "../components/EventManageDashboard";
import { EventManageHero } from "../components/EventManageHero";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { calendarDeepLink } from "../lib/event-links";
import type { ManageLocationState } from "../lib/event-manage-navigation";
import {
  fetchEventAttendanceSummary,
  type EventAttendanceSummary,
} from "../lib/event-checkin-api";
import { fetchEvent, type EventDetailResponse } from "../lib/events-api";
import type { EventVolunteerSignupMember } from "../lib/events-api";
import { fetchEventTasks, type EventTaskResponse } from "../lib/event-tasks-api";
import { fetchAssignableMembers } from "../lib/members-api";
import {
  fetchEventBudgetForEvent,
  type FinanceEventBudgetSummary,
} from "../lib/finance-api";
import type { MemberResponse } from "../lib/auth-api";
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
  const location = useLocation();
  const numericEventId = Number(eventId);
  const { member } = useAuth();
  const initialOpenModal =
    (location.state as ManageLocationState | null)?.openManageModal ?? null;

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
  const [openCheckInModalToken, setOpenCheckInModalToken] = useState(0);
  const [editDetailsToken, setEditDetailsToken] = useState(0);
  const [heroAttendeeCount, setHeroAttendeeCount] = useState<number | null>(
    null,
  );
  const [heroVolunteerCount, setHeroVolunteerCount] = useState<number | null>(
    null,
  );
  const hasLoadedOnceRef = useRef(false);

  const canViewBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const canViewTreasury = member
    ? canManageTreasury(member.role, member.position)
    : false;
  const canManageTasks = member
    ? canManageEventTasks(member.role, member.position)
    : false;

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setOpenTasksModalToken(0);
    setOpenCheckInModalToken(0);
  }, [numericEventId]);

  useEffect(() => {
    if (!Number.isFinite(numericEventId)) {
      setError("Invalid event.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      // Soft refresh keeps the page mounted (and modals closable). Full skeletons
      // only for the initial load for this event id.
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
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
          hasLoadedOnceRef.current = true;
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
    return (
      <div
        className="event-manage-page mx-auto flex w-full max-w-[1280px] flex-col gap-5"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="event-manage-loading">Loading event…</p>
        <div className="event-manage-skeleton h-44 w-full" />
        <div className="event-manage-skeleton h-64 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="event-manage-skeleton h-56" />
          <div className="event-manage-skeleton h-56" />
          <div className="event-manage-skeleton h-56" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    const calendarBackTo = Number.isFinite(numericEventId)
      ? `/events/calendar?event=${numericEventId}`
      : "/events/calendar";

    return (
      <div className="event-manage-page mx-auto flex w-full max-w-[1280px] flex-col gap-5">
        <Link
          to={calendarBackTo}
          className="inline-flex items-center text-sm font-medium text-gray-500 transition duration-150 hover:text-primary"
        >
          ← Back to Events
        </Link>
        <div role="alert" className="ds-alert-banner rounded-2xl p-6">
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

  function handleEditEvent() {
    setEditDetailsToken((current) => current + 1);
  }

  return (
    <div className="event-manage-page mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-0">
      <EventManageHero
        event={event}
        budget={budget}
        tasks={tasks}
        backTo={calendarBackTo}
        onEditEvent={handleEditEvent}
        onCheckIn={() => setOpenCheckInModalToken((current) => current + 1)}
        attendeeCount={heroAttendeeCount}
        volunteerCount={heroVolunteerCount}
      />

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
        onMetricsChange={(metrics) => {
          setHeroAttendeeCount(metrics.attendeeCount);
          setHeroVolunteerCount(metrics.volunteerCount);
        }}
        openTasksModalToken={openTasksModalToken}
        openCheckInModalToken={openCheckInModalToken}
        editDetailsToken={editDetailsToken}
        initialOpenModal={initialOpenModal}
        onDismissOpenTokens={() => {
          setOpenTasksModalToken(0);
          setOpenCheckInModalToken(0);
        }}
      />
    </div>
  );
}
