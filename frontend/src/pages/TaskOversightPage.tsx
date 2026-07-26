/**
 * Task Oversight — event operations center for President / VP.
 * Answers: "Is this event on track?" (not a task board).
 */

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AppIcon } from "../components/ui/AppIcon";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { isToday } from "../lib/calendar";
import {
  fetchTaskOverview,
  type EventTaskResponse,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import { getTaskDisplayName } from "../lib/home-tasks";
import {
  buildOversightSnapshots,
  filterOverviewMembersByEvent,
  formatOversightDueDate,
  isDueWithinNext48Hours,
  isOverdueOpenTask,
  listOversightEvents,
  sortOversightSnapshots,
  type OversightEventOption,
} from "../lib/task-oversight";
import {
  canManageEventTasks,
  canViewTaskOversight,
} from "../lib/roles";

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

function OpsRow({
  title,
  meta,
  emphasize,
}: {
  title: string;
  meta: string;
  emphasize?: boolean;
}) {
  return (
    <li className="ops-oversight-row">
      <p className="ops-oversight-row__title">{title}</p>
      <p
        className={[
          "ops-oversight-row__meta",
          emphasize ? "is-emphasize" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {meta}
      </p>
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

  const eventParam = Number(searchParams.get("event"));
  const selectedEventId =
    Number.isInteger(eventParam) && eventParam > 0 ? eventParam : null;
  const effectiveEventId =
    selectedEventId != null &&
    events.some((event) => event.eventId === selectedEventId)
      ? selectedEventId
      : (events[0]?.eventId ?? null);

  const selectedEvent: OversightEventOption | null =
    events.find((event) => event.eventId === effectiveEventId) ?? null;

  const ops = useMemo(() => {
    if (!overview || effectiveEventId == null) {
      return null;
    }

    const scopedMembers = filterOverviewMembersByEvent(
      overview.members,
      effectiveEventId,
    );
    const eventTasks = flattenOverviewTasks({
      ...overview,
      members: scopedMembers,
    });
    const openTasks = eventTasks.filter(isOpenTask);
    const overdueTasks = openTasks.filter(isOverdueOpenTask);
    const dueTodayTasks = openTasks.filter(
      (task) =>
        !task.is_overdue &&
        task.due_date != null &&
        isToday(new Date(task.due_date)),
    );
    const dueSoonTasks = openTasks.filter(
      (task) => !task.is_overdue && isDueWithinNext48Hours(task),
    );
    const completed = eventTasks.filter(
      (task) => task.is_complete || task.status === "done",
    );
    const snapshots = buildOversightSnapshots(scopedMembers);
    const attentionPeople = sortOversightSnapshots(
      snapshots,
      "incomplete_first",
    ).filter(
      (row) => row.status === "overdue" || row.status === "at_risk",
    );

    const upcoming = [...openTasks]
      .filter((task) => task.due_date && !task.is_overdue)
      .sort(
        (left, right) =>
          new Date(left.due_date!).getTime() -
          new Date(right.due_date!).getTime(),
      )
      .slice(0, 6);

    const workload = sortOversightSnapshots(snapshots, "incomplete_first")
      .filter((row) => row.member.total > 0)
      .slice(0, 8)
      .map((row) => {
        const maxActive = Math.max(
          1,
          ...snapshots.map((entry) => entry.activeTaskCount),
        );
        return {
          memberId: row.member.member_id,
          name: row.member.full_name,
          active: row.activeTaskCount,
          overdue: row.overdueTaskCount,
          widthPct: Math.round((row.activeTaskCount / maxActive) * 100),
          status: row.status,
        };
      });

    const totalTasks = eventTasks.length;
    const completedTasks = completed.length;
    const completePercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      overdueTasks,
      dueSoonTasks,
      completedTasks: completed.slice(0, 8),
      attentionPeople,
      upcoming,
      workload,
      openCount: openTasks.length,
      completedCount: completedTasks,
      overdueCount: overdueTasks.length,
      dueTodayCount: dueTodayTasks.length,
      dueSoonCount: dueSoonTasks.length,
      remainingCount: openTasks.length,
      totalTasks,
      completePercent,
    };
  }, [overview, effectiveEventId]);

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
    canCreateTask && effectiveEventId != null
      ? `/events/${effectiveEventId}/manage`
      : null;

  return (
    <div className="ops-oversight">
      <h1 className="sr-only">Task Oversight</h1>

      {isLoading ? (
        <p className="ops-oversight-loading">Loading oversight…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        events.length === 0 ? (
          <div className="ops-oversight-empty">
            <h3>No event tasks yet</h3>
            <p>Create tasks on an event to oversee them here.</p>
          </div>
        ) : (
          <>
            <div className="ops-oversight-toolbar">
              <label className="ops-oversight-event">
                <span className="ops-oversight-event__label">Event</span>
                <select
                  aria-label="Event"
                  value={effectiveEventId ?? ""}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    const nextParams = new URLSearchParams(searchParams);
                    if (Number.isInteger(next) && next > 0) {
                      nextParams.set("event", String(next));
                    } else {
                      nextParams.delete("event");
                    }
                    setSearchParams(nextParams);
                  }}
                >
                  {events.map((event) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.eventName}
                      {event.overdueTasks > 0
                        ? ` · ${event.overdueTasks} overdue`
                        : event.openTasks > 0
                          ? ` · ${event.openTasks} open`
                          : " · complete"}
                    </option>
                  ))}
                </select>
              </label>
              {newTaskPath ? (
                <Link to={newTaskPath} className="ops-oversight-cta">
                  <AppIcon icon={Plus} size="sm" className="text-current" />
                  New Task
                </Link>
              ) : null}
            </div>

            {selectedEvent && ops ? (
              <div className="ops-oversight-document" aria-label="Event operations">
                <section
                  className="ops-oversight-section"
                  aria-label="Progress"
                >
                  <h3 className="ops-oversight-section__title">Progress</h3>
                  <p className="ops-oversight-progress-count">
                    {ops.completedCount} / {ops.totalTasks} tasks completed
                  </p>
                  <div className="ops-oversight-bar" aria-hidden="true">
                    <div
                      className="ops-oversight-bar__fill"
                      style={{ width: `${ops.completePercent}%` }}
                    />
                  </div>
                  <p className="ops-oversight-progress-pct">
                    {ops.completePercent}%
                  </p>
                  <p className="ops-oversight-stats">
                    <span
                      className={
                        ops.overdueCount > 0 ? "is-overdue" : undefined
                      }
                    >
                      {ops.overdueCount} overdue
                    </span>
                    <span className="ops-oversight-stats__dot" aria-hidden>
                      ·
                    </span>
                    <span>{ops.dueTodayCount} due today</span>
                    <span className="ops-oversight-stats__dot" aria-hidden>
                      ·
                    </span>
                    <span>{ops.remainingCount} remaining</span>
                  </p>
                </section>

                <section
                  className="ops-oversight-section"
                  aria-label="Issues"
                >
                  <h3 className="ops-oversight-section__title">Issues</h3>
                  {ops.overdueTasks.length === 0 &&
                  ops.attentionPeople.length === 0 ? (
                    <p className="ops-oversight-quiet">
                      Nothing needs attention right now.
                    </p>
                  ) : (
                    <ul className="ops-oversight-list">
                      {ops.overdueTasks.map((task) => (
                        <OpsRow
                          key={`issue-${task.id}`}
                          title={getTaskDisplayName(task)}
                          meta={`Owner ${task.assignee_name} · ${overdueLabel(task)}`}
                          emphasize
                        />
                      ))}
                      {ops.attentionPeople
                        .filter(
                          (person) =>
                            !ops.overdueTasks.some(
                              (task) =>
                                task.assignee_id === person.member.member_id,
                            ),
                        )
                        .map((person) => (
                          <OpsRow
                            key={`person-${person.member.member_id}`}
                            title={person.member.full_name}
                            meta={
                              person.status === "at_risk"
                                ? "At risk — due soon or behind pace"
                                : `${person.overdueTaskCount} overdue`
                            }
                            emphasize={person.status === "overdue"}
                          />
                        ))}
                    </ul>
                  )}
                </section>

                <section
                  className="ops-oversight-section"
                  aria-label="Upcoming"
                >
                  <h3 className="ops-oversight-section__title">Upcoming</h3>
                  {ops.upcoming.length === 0 ? (
                    <p className="ops-oversight-quiet">
                      No upcoming deadlines.
                    </p>
                  ) : (
                    <ul className="ops-oversight-list">
                      {ops.upcoming.map((task) => (
                        <OpsRow
                          key={`up-${task.id}`}
                          title={getTaskDisplayName(task)}
                          meta={`${task.assignee_name}${
                            formatOversightDueDate(task.due_date)
                              ? ` · ${formatOversightDueDate(task.due_date)}`
                              : ""
                          }`}
                        />
                      ))}
                    </ul>
                  )}
                </section>

                <section
                  className="ops-oversight-section"
                  aria-label="Team"
                >
                  <h3 className="ops-oversight-section__title">Team</h3>
                  {ops.workload.length === 0 ? (
                    <p className="ops-oversight-quiet">
                      No assignees on this event.
                    </p>
                  ) : (
                    <ul className="ops-oversight-team">
                      {ops.workload.map((row) => (
                        <li key={row.memberId} className="ops-oversight-team__row">
                          <div className="ops-oversight-team__top">
                            <Link
                              to={`/members/${row.memberId}`}
                              className="ops-oversight-team__name"
                            >
                              {row.name}
                            </Link>
                            <span className="ops-oversight-team__meta">
                              {row.active} open
                              {row.overdue > 0 ? (
                                <span className="is-overdue">
                                  {" "}
                                  · {row.overdue} overdue
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className="ops-oversight-bar is-thin" aria-hidden>
                            <div
                              className={[
                                "ops-oversight-bar__fill",
                                row.overdue > 0 ? "is-overdue" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              style={{ width: `${Math.max(8, row.widthPct)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section
                  className="ops-oversight-section"
                  aria-label="Completed"
                >
                  <h3 className="ops-oversight-section__title">Completed</h3>
                  {ops.completedTasks.length === 0 ? (
                    <p className="ops-oversight-quiet">No completed tasks yet.</p>
                  ) : (
                    <ul className="ops-oversight-list is-muted">
                      {ops.completedTasks.map((task) => (
                        <OpsRow
                          key={`done-${task.id}`}
                          title={getTaskDisplayName(task)}
                          meta={task.assignee_name}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
