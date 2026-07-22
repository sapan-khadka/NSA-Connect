import {
  Check,
  ChevronDown,
  Flag,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { KanbanTaskDetailPanel } from "../components/kanban/KanbanTaskDetailPanel";
import { AppIcon } from "../components/ui/AppIcon";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/useAuth";
import { isToday } from "../lib/calendar";
import {
  fetchMyEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
} from "../lib/event-tasks-api";
import {
  buildMarkTaskCompleteRequest,
  getTaskDisplayName,
  getTaskUrgency,
  type TaskUrgency,
} from "../lib/home-tasks";
import {
  applyKanbanMoveLocally,
  getKanbanColumn,
  getKanbanMoveAction,
  isSimpleKanbanTask,
  toKanbanTask,
  type KanbanColumnId,
  type KanbanTask,
} from "../lib/kanban-status";
import { isRoleAtLeast } from "../lib/roles";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; tasks: KanbanTask[] }
  | { status: "error"; message: string };

type WorkspaceView = "list" | "completed";
type UrgencyFilter = "all" | "overdue" | "due_today" | "open";

const PAGE_SIZE = 8;

const URGENCY_LABEL: Record<TaskUrgency, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type BoardTasksStats = {
  assigned: number;
  dueToday: number;
  overdue: number;
  completed: number;
  completedPercent: number;
};

/** Derived from GET /v1/event-tasks/mine — no extra fetch. */
export function calcBoardTasksStats(
  tasks: KanbanTask[],
  now: Date = new Date(),
): BoardTasksStats {
  let dueToday = 0;
  let overdue = 0;
  let completed = 0;

  for (const task of tasks) {
    if (getKanbanColumn(task) === "done") {
      completed += 1;
      continue;
    }
    if (task.is_overdue) {
      overdue += 1;
      continue;
    }
    if (task.due_date && isToday(new Date(task.due_date), now)) {
      dueToday += 1;
    }
  }

  const assigned = tasks.length;
  return {
    assigned,
    dueToday,
    overdue,
    completed,
    completedPercent:
      assigned === 0 ? 0 : Math.round((completed / assigned) * 100),
  };
}

export function getFocusTasks(
  tasks: KanbanTask[],
  now: Date = new Date(),
): KanbanTask[] {
  const overdue: KanbanTask[] = [];
  const dueToday: KanbanTask[] = [];

  for (const task of tasks) {
    if (getKanbanColumn(task) === "done") {
      continue;
    }
    if (task.is_overdue) {
      overdue.push(task);
      continue;
    }
    if (task.due_date && isToday(new Date(task.due_date), now)) {
      dueToday.push(task);
    }
  }

  return [...overdue, ...dueToday];
}

function formatDueDate(isoDate: string | null, now = new Date()): string {
  if (!isoDate) {
    return "—";
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  if (isToday(date, now)) {
    return "Today";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShortDue(isoDate: string | null, now = new Date()): string {
  if (!isoDate) {
    return "—";
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  if (isToday(date, now)) {
    return "Today";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function TaskCheck({
  done,
  busy,
  label,
  onComplete,
}: {
  done: boolean;
  busy: boolean;
  label: string;
  onComplete?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={done ? `${label} completed` : `Mark ${label} complete`}
      disabled={done || busy || !onComplete}
      onClick={(event) => {
        event.stopPropagation();
        onComplete?.();
      }}
      className={["my-tasks-check", done ? "is-done" : ""].filter(Boolean).join(" ")}
    >
      <AppIcon
        icon={Check}
        size="xs"
        className={done ? "text-current opacity-100" : "opacity-0"}
      />
    </button>
  );
}

function PriorityCell({ urgency }: { urgency: TaskUrgency }) {
  return (
    <span
      className={["my-tasks-priority", `is-${urgency}`].join(" ")}
      title="Based on due date urgency"
    >
      <AppIcon
        icon={Flag}
        size="xs"
        className="my-tasks-priority-flag text-current"
      />
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

/** Single segmented control — quieter than dual action pills. */
function StatusSegment({
  task,
  busy,
  onSetColumn,
}: {
  task: KanbanTask;
  busy: boolean;
  onSetColumn: (column: KanbanColumnId) => void;
}) {
  const column = getKanbanColumn(task);
  const options: Array<{
    id: KanbanColumnId;
    label: string;
    className?: string;
  }> = [
    { id: "todo", label: "To do" },
    { id: "in_progress", label: "In progress", className: "is-progress" },
    { id: "done", label: "Done", className: "is-done" },
  ];

  return (
    <div
      className="my-tasks-status-seg"
      role="group"
      aria-label="Set task status"
    >
      {options.map((option) => {
        const pressed = column === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={busy || pressed}
            aria-pressed={pressed}
            className={option.className}
            onClick={(event) => {
              event.stopPropagation();
              onSetColumn(option.id);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function BoardTasksPage() {
  const { member } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [view, setView] = useState<WorkspaceView>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [eventFilter, setEventFilter] = useState<number | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadTasks = useCallback(async () => {
    setLoadState({ status: "loading" });

    try {
      const response = await fetchMyEventTasks();
      setLoadState({
        status: "ready",
        tasks: response.tasks.map((task) => toKanbanTask(task)),
      });
    } catch {
      setLoadState({
        status: "error",
        message: "Unable to load your assigned tasks.",
      });
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [view, urgencyFilter, eventFilter]);

  function replaceTask(updated: KanbanTask) {
    setLoadState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        status: "ready",
        tasks: current.tasks.map((entry) =>
          entry.id === updated.id ? updated : entry,
        ),
      };
    });
  }

  async function handleMoveTask(taskId: number, targetColumn: KanbanColumnId) {
    if (loadState.status !== "ready") {
      return;
    }

    const task = loadState.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    const action = getKanbanMoveAction(task, targetColumn);
    if (!action) {
      return;
    }

    const previousTasks = loadState.tasks;
    const optimisticTask = applyKanbanMoveLocally(task, action);

    setMoveError(null);
    setMovingTaskId(taskId);
    setLoadState({
      status: "ready",
      tasks: previousTasks.map((entry) =>
        entry.id === taskId ? optimisticTask : entry,
      ),
    });

    try {
      const updatedTask =
        action.type === "set_status"
          ? await updateEventTask(taskId, { status: action.status })
          : action.type === "bulk_complete"
            ? await updateEventTask(taskId, { is_complete: action.value })
            : await updateEventTaskChecklistItem(
                taskId,
                action.itemId,
                action.value,
              );

      replaceTask(toKanbanTask(updatedTask));

      if (targetColumn === "done") {
        setSelectedTaskId(taskId);
      }
    } catch {
      setMoveError("Unable to update task. Changes were reverted.");
      setLoadState({ status: "ready", tasks: previousTasks });
    } finally {
      setMovingTaskId(null);
    }
  }

  async function handleCompleteTask(task: KanbanTask) {
    if (getKanbanColumn(task) === "done") {
      return;
    }

    const previousTasks =
      loadState.status === "ready" ? loadState.tasks : null;
    if (!previousTasks) {
      return;
    }

    setMoveError(null);
    setMovingTaskId(task.id);
    setLoadState({
      status: "ready",
      tasks: previousTasks.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              is_complete: true,
              status: "done",
              checklist_items: entry.checklist_items.map((item) => ({
                ...item,
                is_completed: true,
              })),
            }
          : entry,
      ),
    });

    try {
      const updated = await updateEventTask(
        task.id,
        buildMarkTaskCompleteRequest(task),
      );
      replaceTask(toKanbanTask(updated));
    } catch {
      setMoveError("Unable to complete task. Changes were reverted.");
      setLoadState({ status: "ready", tasks: previousTasks });
    } finally {
      setMovingTaskId(null);
    }
  }

  const tasks = loadState.status === "ready" ? loadState.tasks : [];
  const stats = useMemo(() => calcBoardTasksStats(tasks), [tasks]);
  const focusTasks = useMemo(() => getFocusTasks(tasks), [tasks]);
  const selectedTask =
    selectedTaskId !== null
      ? (tasks.find((task) => task.id === selectedTaskId) ?? null)
      : null;

  const eventOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const task of tasks) {
      map.set(task.eventId, task.eventName);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filteredOpenTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (getKanbanColumn(task) === "done") {
        return false;
      }
      if (eventFilter !== "all" && task.eventId !== eventFilter) {
        return false;
      }
      if (urgencyFilter === "overdue") {
        return task.is_overdue;
      }
      if (urgencyFilter === "due_today") {
        return Boolean(
          task.due_date && isToday(new Date(task.due_date)) && !task.is_overdue,
        );
      }
      if (urgencyFilter === "open") {
        return true;
      }
      return true;
    });
  }, [tasks, eventFilter, urgencyFilter]);

  const filteredCompletedTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (getKanbanColumn(task) !== "done") {
        return false;
      }
      if (eventFilter !== "all" && task.eventId !== eventFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, eventFilter]);

  const attentionTasks = useMemo(() => {
    return focusTasks.filter((task) => {
      if (eventFilter !== "all" && task.eventId !== eventFilter) {
        return false;
      }
      if (urgencyFilter === "overdue") {
        return task.is_overdue;
      }
      if (urgencyFilter === "due_today") {
        return Boolean(
          task.due_date && isToday(new Date(task.due_date)) && !task.is_overdue,
        );
      }
      return true;
    });
  }, [focusTasks, eventFilter, urgencyFilter]);

  const listSource =
    view === "completed" ? filteredCompletedTasks : filteredOpenTasks;
  const visibleTasks = listSource.slice(0, visibleCount);
  const canLoadMore = visibleCount < listSource.length;
  const filtersActive = urgencyFilter !== "all" || eventFilter !== "all";

  if (!member) {
    return null;
  }

  return (
    <div className="my-tasks-page">
      <header className="my-tasks-header">
        <div>
          <h1 className="my-tasks-title">My Tasks</h1>
          <p className="my-tasks-subtitle">
            Assigned work across your events — clear overdue items first, then
            keep the rest moving.
          </p>
        </div>
        <button
          type="button"
          className="my-tasks-filter-btn"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <AppIcon icon={SlidersHorizontal} size="sm" className="text-current" />
          Filters
          {filtersActive ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
              On
            </span>
          ) : null}
        </button>
      </header>

      {filtersOpen ? (
        <div className="my-tasks-filter-panel" aria-label="Task filters">
          <div className="my-tasks-filter-field">
            <label htmlFor="my-tasks-filter-urgency">Urgency</label>
            <select
              id="my-tasks-filter-urgency"
              value={urgencyFilter}
              onChange={(event) =>
                setUrgencyFilter(event.target.value as UrgencyFilter)
              }
            >
              <option value="all">All open</option>
              <option value="overdue">Overdue</option>
              <option value="due_today">Due today</option>
              <option value="open">Open only</option>
            </select>
          </div>
          <div className="my-tasks-filter-field">
            <label htmlFor="my-tasks-filter-event">Event</label>
            <select
              id="my-tasks-filter-event"
              value={eventFilter === "all" ? "all" : String(eventFilter)}
              onChange={(event) => {
                const value = event.target.value;
                setEventFilter(value === "all" ? "all" : Number(value));
              }}
            >
              <option value="all">All events</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="my-tasks-filter-btn"
            onClick={() => {
              setUrgencyFilter("all");
              setEventFilter("all");
            }}
          >
            Reset
          </button>
        </div>
      ) : null}

      <div className="my-tasks-toolbar">
        <div
          role="tablist"
          aria-label="Task views"
          className="my-tasks-tabs"
        >
          {(
            [
              ["list", "List"],
              ["completed", "Completed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`my-tasks-tab-${id}`}
              aria-selected={view === id}
              className="my-tasks-tab"
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="my-tasks-stats" aria-label="My tasks summary">
          <span className="my-tasks-stat">
            <strong>{stats.assigned}</strong> Total
          </span>
          <span
            className={[
              "my-tasks-stat",
              stats.overdue > 0 ? "is-overdue" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <strong>{stats.overdue}</strong> Overdue
          </span>
          <span
            className={[
              "my-tasks-stat",
              stats.dueToday > 0 ? "is-today" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <strong>{stats.dueToday}</strong> Due today
          </span>
          <span className="my-tasks-stat is-done">
            <strong>{stats.completedPercent}%</strong> Completed
          </span>
        </div>
      </div>

      {moveError ? (
        <div role="alert" className="ds-alert-banner">
          {moveError}
        </div>
      ) : null}

      {loadState.status === "loading" ? (
        <Card as="div" padding="none" className="p-16 text-center text-label">
          Loading your tasks…
        </Card>
      ) : null}

      {loadState.status === "error" ? (
        <div role="alert" className="ds-alert-banner p-8 text-center">
          {loadState.message}
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length === 0 ? (
        <div className="my-tasks-panel">
          <div className="my-tasks-empty">
            <h3>No tasks assigned to you yet</h3>
            <p>
              {isRoleAtLeast(member.role, "board")
                ? "Create work from an event workspace — assigned tasks will show up here."
                : "When someone assigns you event work, it will show up here automatically."}
            </p>
          </div>
        </div>
      ) : null}

      {loadState.status === "ready" &&
      tasks.length > 0 &&
      view === "list" ? (
        <>
          {attentionTasks.length > 0 ? (
            <section className="my-tasks-panel" aria-label="Needs attention">
              <div className="my-tasks-panel-head">
                <h2 className="my-tasks-panel-title">Needs attention</h2>
                <span className="my-tasks-count-badge">
                  {attentionTasks.length}
                </span>
              </div>
              <ul className="my-tasks-attention-list">
                {attentionTasks.map((task) => {
                  const title = getTaskDisplayName(task);
                  const urgency = getTaskUrgency(task);
                  const busy = movingTaskId === task.id;
                  return (
                    <li key={task.id}>
                      <div className="my-tasks-attention-row">
                        <TaskCheck
                          done={false}
                          busy={busy}
                          label={title}
                          onComplete={() => {
                            void handleCompleteTask(task);
                          }}
                        />
                        <span
                          aria-hidden="true"
                          className={[
                            "my-tasks-dot",
                            task.is_overdue ? "is-overdue" : "is-today",
                          ].join(" ")}
                        />
                        <button
                          type="button"
                          className="my-tasks-cell-main border-0 bg-transparent p-0 text-left"
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <p className="my-tasks-task-name">{title}</p>
                          <p className="my-tasks-task-project">
                            {task.eventName}
                          </p>
                        </button>
                        <div className="my-tasks-attention-meta contents max-[900px]:flex">
                          <span
                            className={
                              task.is_overdue
                                ? "my-tasks-pill is-overdue"
                                : "my-tasks-pill is-today"
                            }
                          >
                            {task.is_overdue ? "Overdue" : "Due today"}
                          </span>
                          <PriorityCell urgency={urgency} />
                          <span className="my-tasks-due">
                            {formatShortDue(task.due_date)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="my-tasks-row-menu"
                          aria-label={`Open ${title}`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <AppIcon
                            icon={MoreHorizontal}
                            size="sm"
                            className="text-current"
                          />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="my-tasks-panel" aria-label="All tasks">
            <div className="my-tasks-panel-head">
              <h2 className="my-tasks-panel-title">All tasks</h2>
              <span className="text-xs font-medium tabular-nums text-label">
                {filteredOpenTasks.length}
              </span>
            </div>

            {filteredOpenTasks.length === 0 ? (
              <div className="my-tasks-empty">
                <h3>No open tasks match these filters</h3>
                <p>Reset filters or switch to Completed to review finished work.</p>
              </div>
            ) : (
              <>
                <div className="my-tasks-table-wrap">
                  <table className="my-tasks-table">
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sr-only">Complete</span>
                        </th>
                        <th scope="col">Task</th>
                        <th scope="col">Event</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Due date</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((task) => {
                        const title = getTaskDisplayName(task);
                        const urgency = getTaskUrgency(task);
                        const column = getKanbanColumn(task);
                        const busy = movingTaskId === task.id;
                        return (
                          <tr key={task.id}>
                            <td>
                              <TaskCheck
                                done={column === "done"}
                                busy={busy}
                                label={title}
                                onComplete={() => {
                                  void handleCompleteTask(task);
                                }}
                              />
                            </td>
                            <td>
                              <div className="my-tasks-table-task">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  <span className="my-tasks-task-name">
                                    {title}
                                  </span>
                                  {!isSimpleKanbanTask(task) ? (
                                    <span className="my-tasks-task-project">
                                      Checklist
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            </td>
                            <td>
                              <span className="text-label">{task.eventName}</span>
                            </td>
                            <td>
                              <PriorityCell urgency={urgency} />
                            </td>
                            <td>
                              <span className="my-tasks-due">
                                {formatDueDate(task.due_date)}
                              </span>
                            </td>
                            <td>
                              <StatusSegment
                                task={task}
                                busy={busy}
                                onSetColumn={(next) => {
                                  void handleMoveTask(task.id, next);
                                }}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="my-tasks-row-menu"
                                aria-label={`Open ${title}`}
                                onClick={() => setSelectedTaskId(task.id)}
                              >
                                <AppIcon
                                  icon={MoreHorizontal}
                                  size="sm"
                                  className="text-current"
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="my-tasks-footer">
                  <p className="my-tasks-footer-meta">
                    Showing 1 to {Math.min(visibleCount, listSource.length)} of{" "}
                    {listSource.length} tasks
                  </p>
                  {canLoadMore ? (
                    <button
                      type="button"
                      className="my-tasks-load-more"
                      onClick={() =>
                        setVisibleCount((count) => count + PAGE_SIZE)
                      }
                    >
                      Load more
                      <AppIcon
                        icon={ChevronDown}
                        size="sm"
                        className="text-current"
                      />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              </>
            )}
          </section>
        </>
      ) : null}

      {loadState.status === "ready" &&
      tasks.length > 0 &&
      view === "completed" ? (
        <section className="my-tasks-panel" aria-label="Completed tasks">
          <div className="my-tasks-panel-head">
            <h2 className="my-tasks-panel-title">Completed</h2>
            <span className="text-xs font-medium tabular-nums text-label">
              {filteredCompletedTasks.length}
            </span>
          </div>

          {filteredCompletedTasks.length === 0 ? (
            <div className="my-tasks-empty">
              <h3>No completed tasks yet</h3>
              <p>Finished work will land here so you can reopen details anytime.</p>
            </div>
          ) : (
            <>
              <div className="my-tasks-table-wrap">
                <table className="my-tasks-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Complete</span>
                      </th>
                      <th scope="col">Task</th>
                      <th scope="col">Event</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Due date</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task) => {
                      const title = getTaskDisplayName(task);
                      const urgency = getTaskUrgency(task);
                      return (
                        <tr key={task.id}>
                          <td>
                            <TaskCheck done busy={false} label={title} />
                          </td>
                          <td>
                            <div className="my-tasks-table-task">
                              <button
                                type="button"
                                onClick={() => setSelectedTaskId(task.id)}
                              >
                                <span className="my-tasks-task-name">
                                  {title}
                                </span>
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className="text-label">{task.eventName}</span>
                          </td>
                          <td>
                            <PriorityCell urgency={urgency} />
                          </td>
                          <td>
                            <span className="my-tasks-due">
                              {formatDueDate(task.due_date)}
                            </span>
                          </td>
                          <td>
                            <StatusSegment
                              task={task}
                              busy={movingTaskId === task.id}
                              onSetColumn={(next) => {
                                void handleMoveTask(task.id, next);
                              }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="my-tasks-row-menu"
                              aria-label={`Open ${title}`}
                              onClick={() => setSelectedTaskId(task.id)}
                            >
                              <AppIcon
                                icon={MoreHorizontal}
                                size="sm"
                                className="text-current"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="my-tasks-footer">
                <p className="my-tasks-footer-meta">
                  Showing 1 to {Math.min(visibleCount, listSource.length)} of{" "}
                  {listSource.length} tasks
                </p>
                {canLoadMore ? (
                  <button
                    type="button"
                    className="my-tasks-load-more"
                    onClick={() =>
                      setVisibleCount((count) => count + PAGE_SIZE)
                    }
                  >
                    Load more
                    <AppIcon
                      icon={ChevronDown}
                      size="sm"
                      className="text-current"
                    />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </>
          )}
        </section>
      ) : null}

      {selectedTask ? (
        <KanbanTaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={(updated) => replaceTask(toKanbanTask(updated))}
        />
      ) : null}
    </div>
  );
}
