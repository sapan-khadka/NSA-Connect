/**
 * Task Oversight — manager dashboard for President / VP.
 * Answers: who needs attention, who's behind, is the event on track?
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "../context/useAuth";
import { Avatar } from "../design-system/components/Avatar";
import { getApiErrorMessage } from "../lib/api-error";
import { isToday } from "../lib/calendar";
import {
  fetchTaskOverview,
  type EventTaskResponse,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
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

function eventOperationsPath(eventId: number): string {
  return `/events/${eventId}/manage?tab=operations&modal=tasks`;
}

function AttentionRow({
  title,
  person,
  eventName,
  showEvent,
  endLabel,
  urgency,
  href,
}: {
  title: string;
  person: string | null;
  eventName: string;
  showEvent: boolean;
  endLabel: string;
  urgency: TaskUrgency;
  href: string;
}) {
  const metaParts = [
    person?.trim() || "Unassigned",
    showEvent ? eventName : null,
    URGENCY_LABEL[urgency],
  ].filter(Boolean) as string[];

  return (
    <li
      className={[
        "event-attention-item",
        urgency === "high" ? "is-fail" : "",
        urgency === "low" ? "is-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="event-attention-mark" aria-hidden="true" />
      <Link to={href} className="event-attention-label ops-oversight-task-link">
        {title}
        <span className="ops-oversight-task-meta">{metaParts.join(" · ")}</span>
      </Link>
      <span
        className={[
          "ops-oversight-end",
          urgency === "high" ? "is-fail" : "",
          urgency === "medium" ? "is-warn" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {endLabel}
      </span>
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
      <div className="ops-oversight event-command">
        <p className="event-command-stat">
          Only the President or Vice President can view the task oversight
          dashboard.
        </p>
      </div>
    );
  }

  const newTaskPath =
    canCreateTask && ops?.createEventId != null
      ? eventOperationsPath(ops.createEventId)
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

  function toggleMemberFilter(memberId: number) {
    updateParam(
      "member",
      selectedMemberId === memberId ? "all" : String(memberId),
    );
  }

  return (
    <div className="ops-oversight event-command">
      <header className="event-command-header">
        <div className="event-command-title-row">
          <h1 className="event-command-title ops-oversight-title">Oversight</h1>
          {newTaskPath ? (
            <Link to={newTaskPath} className={EVENT_MANAGE_ACTION_LINK}>
              New task
            </Link>
          ) : null}
        </div>
        <p className="event-command-meta">
          Who’s blocked, who’s behind, and whether events are on track.
        </p>
        {overview && !isLoading && !error && allTasks.length > 0 && ops ? (
          <>
            <div className="event-command-actions ops-oversight-filters">
              <label className="ops-oversight-filter">
                <span className="sr-only">Event</span>
                <select
                  aria-label="Event"
                  value={
                    selectedEventId == null ? "all" : String(selectedEventId)
                  }
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
              className="event-command-metrics"
              aria-label="Oversight summary"
            >
              <section className="event-command-metric">
                <p className="event-command-metric-value">{ops.openCount}</p>
                <span className="event-command-metric-label">Open</span>
              </section>
              <section
                className={[
                  "event-command-metric",
                  ops.overdueCount > 0 ? "is-overdue" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="event-command-metric-value">{ops.overdueCount}</p>
                <span className="event-command-metric-label">Overdue</span>
              </section>
              <section className="event-command-metric">
                <p className="event-command-metric-value">
                  {ops.completedCount}
                </p>
                <span className="event-command-metric-label">Completed</span>
              </section>
              <section className="event-command-metric">
                <p className="event-command-metric-value">
                  {ops.completePercent}%
                </p>
                <span className="event-command-metric-label">Completion</span>
              </section>
            </div>
          </>
        ) : null}
      </header>

      {isLoading ? (
        <p className="event-command-stat">Loading oversight…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        allTasks.length === 0 ? (
          <p className="event-command-stat">
            No event tasks yet. Create tasks on an event to oversee them here.
          </p>
        ) : ops ? (
          <>
            <div
              className="event-command-body"
              aria-label="Event operations"
            >
              <div className="event-command-layout">
                <section
                  className="event-command-section is-flush"
                  aria-label="Needs Attention"
                >
                  <div className="event-command-section-head">
                    <h2 className="event-command-kicker">Needs attention</h2>
                    <p className="event-command-count">
                      {ops.needsAttention.length === 0
                        ? "Clear"
                        : String(ops.needsAttention.length)}
                    </p>
                  </div>
                  {ops.needsAttention.length === 0 ? (
                    <p className="event-command-stat">
                      Nothing is overdue or due in the next 48 hours.
                    </p>
                  ) : (
                    <ul className="event-attention-list">
                      {ops.needsAttention.map(({ task, urgency, endLabel }) => (
                        <AttentionRow
                          key={`attention-${task.id}`}
                          title={getTaskDisplayName(task)}
                          person={task.assignee_name}
                          eventName={task.event_name}
                          showEvent={selectedEventId == null}
                          endLabel={endLabel}
                          urgency={urgency}
                          href={eventOperationsPath(task.event_id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>

                {ops.workload.length > 0 ? (
                  <aside
                    className="event-command-section event-command-aside"
                    aria-label="Team Progress"
                  >
                    <div className="event-command-section-head">
                      <h2 className="event-command-kicker">Team</h2>
                      <p className="event-command-count">
                        {ops.workload.length}
                      </p>
                    </div>
                    <ul className="ops-oversight-team">
                      {ops.workload.map((row) => (
                        <li key={row.memberId} className="ops-oversight-team__row">
                          <div className="ops-oversight-team__top">
                            <button
                              type="button"
                              className={[
                                "ops-oversight-team__person",
                                selectedMemberId === row.memberId
                                  ? "is-active"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => toggleMemberFilter(row.memberId)}
                              aria-pressed={selectedMemberId === row.memberId}
                            >
                              <Avatar
                                name={row.name}
                                memberId={row.memberId}
                                size="sm"
                                className="ops-oversight-assignee__avatar"
                              />
                              <span className="ops-oversight-team__name">
                                {row.name}
                              </span>
                            </button>
                            <span className="ops-oversight-team__fraction">
                              {row.done}/{row.total}
                              {row.overdue > 0 ? (
                                <span className="is-overdue">
                                  {" "}
                                  · {row.overdue} overdue
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div
                            className={[
                              "event-command-progress",
                              row.overdue > 0 ? "is-fail" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            role="progressbar"
                            aria-valuenow={row.completePercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${row.name} completion`}
                          >
                            <span style={{ width: `${row.completePercent}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </aside>
                ) : null}
              </div>

              {ops.recentlyCompleted.length > 0 ? (
                <section
                  className="event-command-section"
                  aria-label="Recently Completed"
                >
                  <div className="event-command-section-head">
                    <h2 className="event-command-kicker">Recently completed</h2>
                    <p className="event-command-count">
                      {ops.recentlyCompleted.length}
                    </p>
                  </div>
                  <ul className="event-command-activity">
                    {ops.recentlyCompleted.map((task) => {
                      const doneMeta = [
                        task.assignee_name,
                        selectedEventId == null ? task.event_name : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <li key={`done-${task.id}`}>
                          <Link
                            to={eventOperationsPath(task.event_id)}
                            className="ops-oversight-task-link"
                          >
                            {getTaskDisplayName(task)}
                            {doneMeta ? (
                              <span className="ops-oversight-task-meta">
                                {doneMeta}
                              </span>
                            ) : null}
                          </Link>
                          <time
                            className="shrink-0 text-xs tabular-nums text-gray-400"
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
                <p className="event-command-stat">
                  Nothing to show for this filter. Try All events or All
                  members.
                </p>
              ) : null}
            </div>
          </>
        ) : null
      ) : null}
    </div>
  );
}
