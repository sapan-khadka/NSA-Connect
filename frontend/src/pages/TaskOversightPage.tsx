/**
 * Task Oversight — manager dashboard for President / VP.
 * Answers: who needs attention, who's behind, is the event on track?
 */

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AppIcon } from "../components/ui/AppIcon";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/useAuth";
import { Avatar } from "../design-system/components/Avatar";
import { getApiErrorMessage } from "../lib/api-error";
import { isToday } from "../lib/calendar";
import {
  fetchTaskOverview,
  type EventTaskResponse,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import { formatRelativeTimestamp } from "../lib/format-datetime";
import {
  getTaskDisplayName,
  getTaskUrgency,
  type TaskUrgency,
} from "../lib/home-tasks";
import {
  buildOversightSnapshots,
  filterOverviewMembersByEvent,
  isDueWithinNext48Hours,
  isOverdueOpenTask,
  listOversightEvents,
  sortOversightSnapshots,
} from "../lib/task-oversight";
import {
  canManageEventTasks,
  canViewTaskOversight,
} from "../lib/roles";

const URGENCY_LABEL: Record<TaskUrgency, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function flattenOverviewTasks(
  overview: TaskOverviewResponse,
): EventTaskResponse[] {
  const byId = new Map<number, EventTaskResponse>();
  for (const member of overview.members) {
    for (const task of member.tasks) {
      byId.set(task.id, task);
    }
  }
  return [...byId.values()];
}

function isOpenTask(task: EventTaskResponse): boolean {
  return !task.is_complete && task.status !== "done";
}

function overdueLabel(task: EventTaskResponse, now = new Date()): string {
  if (!task.due_date) {
    return "Overdue";
  }
  const dueMs = Date.parse(task.due_date);
  if (Number.isNaN(dueMs)) {
    return "Overdue";
  }
  const days = Math.max(
    1,
    Math.floor((now.getTime() - dueMs) / (24 * 60 * 60 * 1000)),
  );
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

function AttentionRow({
  title,
  person,
  eventName,
  showEvent,
  endLabel,
  urgency,
}: {
  title: string;
  person: string | null;
  eventName: string;
  showEvent: boolean;
  endLabel: string;
  urgency: TaskUrgency;
}) {
  const metaParts = [
    person?.trim() || "Unassigned",
    showEvent ? eventName : null,
    URGENCY_LABEL[urgency],
  ].filter(Boolean) as string[];

  return (
    <li className={["ops-oversight-attention", `is-${urgency}`].join(" ")}>
      <div className="ops-oversight-attention__main">
        <div className="ops-oversight-attention__body">
          <div className="ops-oversight-attention__heading">
            <span className="ops-oversight-attention__dot" aria-hidden="true" />
            <p className="ops-oversight-attention__title">{title}</p>
          </div>
          <p className="ops-oversight-attention__meta">
            {metaParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? (
                  <span className="ops-oversight-sep" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                {part}
              </span>
            ))}
          </p>
        </div>
        <span className="ops-oversight-attention__end">{endLabel}</span>
      </div>
    </li>
  );
}

export function TaskOversightPage() {
  const { member } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<TaskOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed = member
    ? canViewTaskOversight(member.role, member.position)
    : false;
  const canCreateTask = member
    ? canManageEventTasks(member.role, member.position)
    : false;

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTaskOverview();
        if (!cancelled) {
          setOverview(response);
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
  }, [allowed]);

  const allTasks = useMemo(
    () => (overview ? flattenOverviewTasks(overview) : []),
    [overview],
  );

  const events = useMemo(() => listOversightEvents(allTasks), [allTasks]);

  const eventParam = searchParams.get("event");
  const selectedEventId =
    eventParam === "all" || eventParam == null || eventParam === ""
      ? null
      : Number.isInteger(Number(eventParam)) && Number(eventParam) > 0
        ? Number(eventParam)
        : null;

  const memberParam = Number(searchParams.get("member"));
  const selectedMemberId =
    Number.isInteger(memberParam) && memberParam > 0 ? memberParam : null;

  const ops = useMemo(() => {
    if (!overview) {
      return null;
    }

    const scopedMembers =
      selectedEventId == null
        ? overview.members
        : filterOverviewMembersByEvent(overview.members, selectedEventId);

    const memberScoped =
      selectedMemberId == null
        ? scopedMembers
        : scopedMembers.filter(
            (entry) => entry.member_id === selectedMemberId,
          );

    const eventTasks = flattenOverviewTasks({
      ...overview,
      members: memberScoped,
    });
    const openTasks = eventTasks.filter(isOpenTask);
    const overdueTasks = openTasks.filter(isOverdueOpenTask);
    const dueSoonTasks = openTasks.filter(
      (task) =>
        !task.is_overdue &&
        (isDueWithinNext48Hours(task) ||
          (task.due_date != null && isToday(new Date(task.due_date)))),
    );
    const completed = eventTasks
      .filter((task) => task.is_complete || task.status === "done")
      .sort((left, right) => {
        const leftAt = left.completed_at ? Date.parse(left.completed_at) : 0;
        const rightAt = right.completed_at ? Date.parse(right.completed_at) : 0;
        return rightAt - leftAt;
      });

    const snapshots = buildOversightSnapshots(memberScoped);
    const workload = sortOversightSnapshots(snapshots, "incomplete_first")
      .filter((row) => row.member.total > 0)
      .slice(0, 12)
      .map((row) => ({
        memberId: row.member.member_id,
        name: row.member.full_name,
        overdue: row.overdueTaskCount,
        done: row.doneTaskCount,
        total: row.member.total,
        completePercent: row.completionPercent,
      }));

    const memberOptions = sortOversightSnapshots(
      buildOversightSnapshots(scopedMembers),
      "alphabetical",
    )
      .filter((row) => row.member.total > 0)
      .map((row) => ({
        id: row.member.member_id,
        name: row.member.full_name,
      }));

    const needsAttention = [
      ...overdueTasks.map((task) => ({
        task,
        urgency: "high" as const,
        endLabel: overdueLabel(task),
      })),
      ...dueSoonTasks.map((task) => ({
        task,
        urgency: getTaskUrgency(task),
        endLabel: isToday(new Date(task.due_date!)) ? "Due today" : "Due soon",
      })),
    ];

    const totalTasks = eventTasks.length;
    const completedCount = completed.length;
    const openCount = openTasks.length;
    const overdueCount = overdueTasks.length;
    const completePercent =
      totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    return {
      needsAttention,
      workload,
      memberOptions,
      recentlyCompleted: completed.slice(0, 8),
      openCount,
      overdueCount,
      completedCount,
      completePercent,
      totalTasks,
      createEventId: selectedEventId ?? events[0]?.eventId ?? null,
    };
  }, [overview, selectedEventId, selectedMemberId, events]);

  if (!member) {
    return null;
  }

  if (!allowed) {
    return (
      <Card padding="md" className="text-foreground">
        Only the President or Vice President can view the task oversight
        dashboard.
      </Card>
    );
  }

  const newTaskPath =
    canCreateTask && ops?.createEventId != null
      ? `/events/${ops.createEventId}/manage`
      : null;

  function updateParam(key: "event" | "member", value: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (value === "all" || value === "") {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams);
  }

  return (
    <div className="ops-oversight">
      <header className="ops-oversight-header">
        <div className="ops-oversight-heading">
          <div className="ops-oversight-title-row">
            <h1 className="ops-oversight-title">Oversight</h1>
            {newTaskPath ? (
              <Link to={newTaskPath} className="ops-oversight-cta">
                <AppIcon icon={Plus} size="xs" className="text-current" />
                New Task
              </Link>
            ) : null}
          </div>
          <p className="ops-oversight-subtitle">
            Track team progress and identify blockers.
          </p>
        </div>
      </header>

      {isLoading ? (
        <p className="ops-oversight-loading">Loading oversight…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        allTasks.length === 0 ? (
          <div className="ops-oversight-empty">
            <h3>No event tasks yet</h3>
            <p>Create tasks on an event to oversee them here.</p>
          </div>
        ) : ops ? (
          <>
            <div className="ops-oversight-filters">
              <label className="ops-oversight-filter">
                <span className="sr-only">Event</span>
                <select
                  aria-label="Event"
                  value={selectedEventId == null ? "all" : String(selectedEventId)}
                  onChange={(event) => updateParam("event", event.target.value)}
                >
                  <option value="all">All events</option>
                  {events.map((event) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ops-oversight-filter">
                <span className="sr-only">Member</span>
                <select
                  aria-label="Member"
                  value={
                    selectedMemberId == null ? "all" : String(selectedMemberId)
                  }
                  onChange={(event) =>
                    updateParam("member", event.target.value)
                  }
                >
                  <option value="all">All members</option>
                  {ops.memberOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              className="ops-oversight-kpi"
              aria-label="Oversight summary"
            >
              <div className="ops-oversight-kpi__cell">
                <p className="ops-oversight-kpi__value">{ops.openCount}</p>
                <p className="ops-oversight-kpi__label">Open</p>
              </div>
              <div
                className={[
                  "ops-oversight-kpi__cell",
                  ops.overdueCount > 0 ? "is-overdue" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="ops-oversight-kpi__value">{ops.overdueCount}</p>
                <p className="ops-oversight-kpi__label">Overdue</p>
              </div>
              <div className="ops-oversight-kpi__cell">
                <p className="ops-oversight-kpi__value">{ops.completedCount}</p>
                <p className="ops-oversight-kpi__label">Completed</p>
              </div>
              <div className="ops-oversight-kpi__cell">
                <p className="ops-oversight-kpi__value">{ops.completePercent}%</p>
                <p className="ops-oversight-kpi__label">Completion</p>
              </div>
            </div>

            <div className="ops-oversight-workspace" aria-label="Event operations">
              {ops.needsAttention.length > 0 ? (
                <section
                  className="ops-oversight-panel"
                  aria-label="Needs Attention"
                >
                  <h2 className="ops-oversight-panel__title">
                    Needs Attention
                    <span className="ops-oversight-panel__count">
                      {" "}
                      · {ops.needsAttention.length}
                    </span>
                  </h2>
                  <ul className="ops-oversight-attention-list">
                    {ops.needsAttention.map(({ task, urgency, endLabel }) => (
                      <AttentionRow
                        key={`attention-${task.id}`}
                        title={getTaskDisplayName(task)}
                        person={task.assignee_name}
                        eventName={task.event_name}
                        showEvent={selectedEventId == null}
                        endLabel={endLabel}
                        urgency={urgency}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {ops.workload.length > 0 ? (
                <section
                  className="ops-oversight-panel"
                  aria-label="Team Progress"
                >
                  <h2 className="ops-oversight-panel__title">
                    Team Progress
                    <span className="ops-oversight-panel__count">
                      {" "}
                      · {ops.workload.length}
                    </span>
                  </h2>
                  <ul className="ops-oversight-team">
                    {ops.workload.map((row) => (
                      <li key={row.memberId} className="ops-oversight-team__row">
                        <div className="ops-oversight-team__top">
                          <Link
                            to={`/members/${row.memberId}`}
                            className="ops-oversight-team__person"
                          >
                            <Avatar
                              name={row.name}
                              size="sm"
                              className="ops-oversight-assignee__avatar"
                            />
                            <span className="ops-oversight-team__name">
                              {row.name}
                            </span>
                          </Link>
                          <span className="ops-oversight-team__fraction">
                            {row.done} / {row.total}
                            {row.overdue > 0 ? (
                              <span className="is-overdue">
                                {" "}
                                · {row.overdue} overdue
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <div className="ops-oversight-team__barline">
                          <div
                            className="ops-oversight-workload"
                            aria-hidden="true"
                          >
                            <div
                              className={[
                                "ops-oversight-workload__fill",
                                row.overdue > 0 ? "is-overdue" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              style={{ width: `${row.completePercent}%` }}
                            />
                          </div>
                          <span className="ops-oversight-team__pct">
                            {row.completePercent}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {ops.recentlyCompleted.length > 0 ? (
                <section
                  className="ops-oversight-panel"
                  aria-label="Recently Completed"
                >
                  <h2 className="ops-oversight-panel__title">
                    Recently Completed
                    <span className="ops-oversight-panel__count">
                      {" "}
                      · {ops.recentlyCompleted.length}
                    </span>
                  </h2>
                  <ul className="ops-oversight-done-list">
                    {ops.recentlyCompleted.map((task) => {
                      const doneMeta = [
                        task.assignee_name,
                        selectedEventId == null ? task.event_name : null,
                      ].filter(Boolean) as string[];

                      return (
                        <li
                          key={`done-${task.id}`}
                          className="ops-oversight-done"
                        >
                          <div className="ops-oversight-done__body">
                            <p className="ops-oversight-done__title">
                              {getTaskDisplayName(task)}
                            </p>
                            {doneMeta.length > 0 ? (
                              <p className="ops-oversight-done__meta">
                                {doneMeta.map((part, index) => (
                                  <span key={`${part}-${index}`}>
                                    {index > 0 ? (
                                      <span
                                        className="ops-oversight-sep"
                                        aria-hidden="true"
                                      >
                                        ·
                                      </span>
                                    ) : null}
                                    {part}
                                  </span>
                                ))}
                              </p>
                            ) : null}
                          </div>
                          <time
                            className="ops-oversight-done__when"
                            dateTime={task.completed_at ?? undefined}
                          >
                            {task.completed_at
                              ? formatRelativeTimestamp(task.completed_at)
                              : "Completed"}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {ops.needsAttention.length === 0 &&
              ops.workload.length === 0 &&
              ops.recentlyCompleted.length === 0 ? (
                <div className="ops-oversight-empty">
                  <h3>Nothing to show for this filter</h3>
                  <p>Try All events or All members to widen the view.</p>
                </div>
              ) : null}
            </div>
          </>
        ) : null
      ) : null}
    </div>
  );
}
