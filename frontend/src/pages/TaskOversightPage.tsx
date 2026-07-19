/**
 * Task Oversight — event-scoped Kanban + workload for President / VP.
 * Pick an event first; stats, board, and side rail only show that event.
 */

import {
  AlertCircle,
  CalendarClock,
  ListTodo,
  Plus,
  Search,
  Users,
} from "lucide-react";
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
  type EventTaskStatus,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import { getTaskDisplayName, getTaskUrgency } from "../lib/home-tasks";
import {
  buildOversightSnapshots,
  filterOverviewMembersByEvent,
  formatOversightDueDate,
  listOversightEvents,
  sortOversightSnapshots,
  type OversightEventOption,
} from "../lib/task-oversight";
import {
  canManageEventTasks,
  canViewTaskOversight,
} from "../lib/roles";

type BoardColumn = {
  id: EventTaskStatus;
  label: string;
};

const COLUMNS: BoardColumn[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

const URGENCY_LABEL = {
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

const URGENCY_CLASS = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-emerald-50 text-emerald-700",
} as const;

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function OversightTaskCard({ task }: { task: EventTaskResponse }) {
  const urgency = getTaskUrgency(task);
  const dueLabel = formatOversightDueDate(task.due_date);
  const checklistDone = task.checklist_items.filter((item) => item.is_completed)
    .length;
  const checklistTotal = task.checklist_items.length;
  const progress =
    task.status === "done"
      ? 100
      : checklistTotal > 0
        ? Math.round((checklistDone / checklistTotal) * 100)
        : task.status === "in_progress"
          ? 50
          : 0;

  return (
    <article className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold leading-snug text-foreground">
          {getTaskDisplayName(task)}
        </h3>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            URGENCY_CLASS[urgency],
          ].join(" ")}
        >
          {URGENCY_LABEL[urgency]}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-badge-teal-bg text-[10px] font-semibold text-primary">
          {initials(task.assignee_name)}
        </span>
        <span className="truncate text-xs text-gray-600">
          {task.assignee_name}
        </span>
      </div>

      <p className="mt-2 truncate text-[11px] text-gray-500">
        {dueLabel ?? "No due date"}
        {task.is_overdue && !task.is_complete ? " · Overdue" : ""}
      </p>

      {task.status !== "todo" || checklistTotal > 0 ? (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500">
            <span>
              {checklistTotal > 0
                ? `${checklistDone}/${checklistTotal}`
                : task.status === "done"
                  ? "Complete"
                  : "In progress"}
            </span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className={[
                "h-full rounded-full transition-[width]",
                task.status === "done" ? "bg-emerald-500" : "bg-primary",
              ].join(" ")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function TaskOversightPage() {
  const { member } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<TaskOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EventTaskStatus>(
    "all",
  );

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

  const {
    tasks,
    needsAttentionCount,
    overdueCount,
    dueTodayCount,
    openCount,
    completePercent,
    completedTasks,
    totalTasks,
    deadlines,
    workload,
  } = useMemo(() => {
    if (!overview || effectiveEventId == null) {
      return {
        tasks: [] as EventTaskResponse[],
        needsAttentionCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        openCount: 0,
        completePercent: 0,
        completedTasks: 0,
        totalTasks: 0,
        deadlines: [] as EventTaskResponse[],
        workload: [] as Array<{
          memberId: number;
          name: string;
          active: number;
          overdue: number;
          widthPct: number;
        }>,
      };
    }

    const scopedMembers = filterOverviewMembersByEvent(
      overview.members,
      effectiveEventId,
    );
    const eventTasks = flattenOverviewTasks({
      ...overview,
      members: scopedMembers,
    });
    const openTasks = eventTasks.filter((task) => !task.is_complete);
    const overdueTasks = openTasks.filter((task) => task.is_overdue);
    const dueTodayTasks = openTasks.filter(
      (task) =>
        !task.is_overdue &&
        task.due_date != null &&
        isToday(new Date(task.due_date)),
    );
    const snapshots = buildOversightSnapshots(scopedMembers);
    const attentionMembers = snapshots.filter(
      (row) => row.status === "overdue" || row.status === "at_risk",
    ).length;
    const completed = eventTasks.filter(
      (task) => task.is_complete || task.status === "done",
    ).length;

    const upcomingDeadlines = [...openTasks]
      .filter((task) => task.due_date)
      .sort(
        (left, right) =>
          new Date(left.due_date!).getTime() -
          new Date(right.due_date!).getTime(),
      )
      .slice(0, 5);

    const workloadRows = sortOversightSnapshots(snapshots, "incomplete_first")
      .filter((row) => row.member.total > 0)
      .slice(0, 6)
      .map((row) => ({
        memberId: row.member.member_id,
        name: row.member.full_name,
        active: row.activeTaskCount,
        overdue: row.overdueTaskCount,
      }));

    const maxActive = Math.max(1, ...workloadRows.map((row) => row.active));

    return {
      tasks: eventTasks,
      needsAttentionCount: attentionMembers,
      overdueCount: overdueTasks.length,
      dueTodayCount: dueTodayTasks.length,
      openCount: openTasks.length,
      completePercent:
        eventTasks.length > 0
          ? Math.round((completed / eventTasks.length) * 100)
          : 0,
      completedTasks: completed,
      totalTasks: eventTasks.length,
      deadlines: upcomingDeadlines,
      workload: workloadRows.map((row) => ({
        ...row,
        widthPct: Math.round((row.active / maxActive) * 100),
      })),
    };
  }, [overview, effectiveEventId]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        getTaskDisplayName(task).toLowerCase().includes(query) ||
        task.assignee_name.toLowerCase().includes(query)
      );
    });
  }, [tasks, search, statusFilter]);

  const columns = useMemo(() => {
    return COLUMNS.map((column) => ({
      ...column,
      items: filteredTasks.filter((task) => task.status === column.id),
    }));
  }, [filteredTasks]);

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

  const stats = [
    {
      id: "attention",
      label: "Needs Attention",
      value: needsAttentionCount,
      hint: "Assignees overdue or at risk",
      icon: AlertCircle,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: overdueCount,
      hint: "Open tasks past due",
      icon: CalendarClock,
      tone: "bg-amber-50 text-amber-800",
    },
    {
      id: "due-today",
      label: "Due Today",
      value: dueTodayCount,
      hint: "Tasks due today",
      icon: ListTodo,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      id: "open",
      label: "Open",
      value: openCount,
      hint: "Incomplete tasks for this event",
      icon: ListTodo,
      tone: "bg-violet-50 text-violet-700",
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Task Oversight
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">
            {selectedEvent
              ? `Track progress for ${selectedEvent.eventName}.`
              : "Pick an event to track progress and risks."}
          </p>
        </div>
        {newTaskPath ? (
          <Link
            to={newTaskPath}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            <AppIcon icon={Plus} size="sm" className="text-current" />
            New Task
          </Link>
        ) : null}
      </header>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading oversight…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        events.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-600">
            No event tasks yet. Create tasks on an event to oversee them here.
          </Card>
        ) : (
          <>
            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Event</span>
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
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 sm:max-w-md"
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
              {selectedEvent ? (
                <p className="mt-2 text-xs text-gray-500">
                  {selectedEvent.openTasks} open
                  {selectedEvent.overdueTasks > 0
                    ? ` · ${selectedEvent.overdueTasks} overdue`
                    : ""}
                  {" · "}
                  {selectedEvent.completedTasks} of {selectedEvent.totalTasks}{" "}
                  complete
                </p>
              ) : null}
            </div>

            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <li
                  key={stat.id}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                        stat.tone,
                      ].join(" ")}
                    >
                      <AppIcon
                        icon={stat.icon}
                        size="xs"
                        className="text-current"
                      />
                    </span>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{stat.hint}</p>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
              <div className="min-w-0 space-y-3 xl:col-span-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Search tasks</span>
                    <AppIcon
                      icon={Search}
                      size="xs"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search tasks or members…"
                      className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </label>
                  <label className="shrink-0 text-sm text-gray-600">
                    <span className="sr-only">Status</span>
                    <select
                      aria-label="Status"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as "all" | EventTaskStatus,
                        )
                      }
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="all">All statuses</option>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                </div>

                <div
                  className="grid grid-cols-1 gap-3 md:grid-cols-3"
                  aria-label="Task board"
                >
                  {columns.map((column) => (
                    <section
                      key={column.id}
                      aria-label={column.label}
                      className="rounded-xl border border-gray-100 bg-slate-50/80 p-2.5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <h2 className="text-sm font-semibold text-foreground">
                          {column.label}
                        </h2>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 ring-1 ring-inset ring-gray-200">
                          {column.items.length}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {column.items.length === 0 ? (
                          <li className="rounded-lg border border-dashed border-gray-200 bg-white/60 px-3 py-6 text-center text-xs text-gray-500">
                            No tasks
                          </li>
                        ) : (
                          column.items.map((task) => (
                            <li key={task.id}>
                              <OversightTaskCard task={task} />
                            </li>
                          ))
                        )}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>

              <aside className="flex min-w-0 flex-col gap-3 xl:col-span-4">
                <section
                  aria-label="Event health"
                  className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <AppIcon icon={Users} size="sm" className="text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">
                      Event Health
                    </h2>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {completePercent}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {completedTasks} of {totalTasks} tasks complete
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${completePercent}%` }}
                    />
                  </div>
                </section>

                <section
                  aria-label="Upcoming deadlines"
                  className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <h2 className="text-sm font-semibold text-foreground">
                    Upcoming Deadlines
                  </h2>
                  {deadlines.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                      No open deadlines for this event.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {deadlines.map((task) => (
                        <li
                          key={task.id}
                          className="rounded-lg border border-gray-100 px-2.5 py-2"
                        >
                          <p className="truncate text-xs font-medium text-foreground">
                            {getTaskDisplayName(task)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {task.assignee_name}
                            {formatOversightDueDate(task.due_date)
                              ? ` · ${formatOversightDueDate(task.due_date)}`
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section
                  aria-label="Team workload"
                  className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <h2 className="text-sm font-semibold text-foreground">
                    Team Workload
                  </h2>
                  {workload.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                      No assignees on this event.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2.5">
                      {workload.map((row) => (
                        <li key={row.memberId}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <Link
                              to={`/members/${row.memberId}`}
                              className="truncate text-xs font-medium text-foreground hover:text-primary"
                            >
                              {row.name}
                            </Link>
                            <span className="shrink-0 text-[11px] tabular-nums text-gray-500">
                              {row.active}
                              {row.overdue > 0 ? (
                                <span className="text-rose-700">
                                  {" "}
                                  · {row.overdue} overdue
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={[
                                "h-full rounded-full",
                                row.overdue > 0 ? "bg-rose-500" : "bg-primary",
                              ].join(" ")}
                              style={{ width: `${row.widthPct}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </aside>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
