import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { canCreateEventTasks } from "../lib/event-finance";
import { EventFinanceCloseoutBanner } from "../components/EventFinanceCloseoutBanner";
import { EventTaskManager } from "../components/EventTaskManager";
import { MeetingRecordSection } from "../components/MeetingRecordSection";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchEvent, type EventDetailResponse } from "../lib/events-api";
import { fetchEventTasks, type EventTaskResponse } from "../lib/event-tasks-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import {
  budgetProgressBarClass,
  budgetStatusClass,
  budgetStatusLabel,
  budgetUsagePercent,
  formatBudgetRemaining,
} from "../lib/event-budget";
import { fetchAssignableMembers } from "../lib/members-api";
import { fetchEventBudgetForEvent } from "../lib/finance-api";
import type { MemberResponse } from "../lib/auth-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { FinanceEntryList } from "../components/FinanceEntryList";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  canManageEventTasks,
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

  const canViewBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const canViewTreasury = member ? isRoleAtLeast(member.role, "treasurer") : false;
  const canManageTasks = member
    ? canManageEventTasks(member.role, member.position)
    : false;

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "done").length;
    const inProgress = tasks.filter(
      (task) => task.status === "in_progress",
    ).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, percent };
  }, [tasks]);

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

  if (isLoading) {
    return <p className="text-sm text-label">Loading event…</p>;
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <Link to="/events/calendar" className="ds-link">
          ← Back to calendar
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

  const usagePercent = budget
    ? budgetUsagePercent(budget.planned_budget, budget.actual_expense)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/events/calendar" className="ds-link">
          ← Back to calendar
        </Link>
      </div>

      <section className="ds-card p-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-light tracking-headline text-foreground">{event.name}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
          >
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
        </div>
        <p className="mt-2 text-label">{formatEventDateTime(event.starts_at)}</p>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          {event.description}
        </p>
      </section>

      <EventFinanceCloseoutBanner event={event} />

      {event.event_type === "meeting" ? (
        <MeetingRecordSection eventId={numericEventId} eventName={event.name} />
      ) : null}

      {canViewBoard ? (
        <section className="ds-card p-6">
          <h2 className="text-lg font-light tracking-subhead text-foreground">Task completion</h2>
          <p className="mt-1 text-sm text-label">
            Progress on assigned tasks for this event only.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
              {taskStats.completed}/{taskStats.total} done ({taskStats.percent}%)
            </span>
            <span className="text-sm text-label">
              {taskStats.inProgress} in progress
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${taskStats.percent}%` }}
            />
          </div>
        </section>
      ) : null}

      {budget ? (
        <section className="ds-card p-6">
          <h2 className="text-lg font-light tracking-subhead text-foreground">Event budget</h2>
          <p className="mt-1 text-sm text-label">
            Planned budget vs logged income and expenses for this event.
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-label">
                Planned
              </dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatCurrency(budget.planned_budget)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-label">
                Expenses
              </dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatCurrency(budget.actual_expense)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-label">
                Income
              </dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatCurrency(budget.actual_income)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-label">
                Remaining
              </dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatBudgetRemaining(budget.budget_remaining)}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-label">
              <span>Budget usage</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${budgetProgressBarClass(budget)}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className={`mt-2 text-sm ${budgetStatusClass(budget)}`}>
              {budgetStatusLabel(budget)}
            </p>
          </div>
        </section>
      ) : null}

      {canViewBoard && event ? (
        <EventTaskManager
          eventId={numericEventId}
          eventName={event.name}
          member={member}
          canManageSimple={canManageTasks}
          canCreateTasks={canCreateEventTasks(event)}
          canAssignChecklist={canViewBoard}
          assignableMembers={assignableMembers}
          refreshKey={refreshKey}
        />
      ) : null}

      {canViewTreasury ? (
        <FinanceEntryList
          semester="all"
          refreshKey={refreshKey}
          eventId={numericEventId}
          canManage={!event.is_finance_locked}
          financeLocked={event.is_finance_locked}
          onChanged={() => setRefreshKey((current) => current + 1)}
        />
      ) : null}
    </div>
  );
}
