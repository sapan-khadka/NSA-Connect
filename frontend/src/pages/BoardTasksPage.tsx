import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { KanbanTaskDetailPanel } from "../components/kanban/KanbanTaskDetailPanel";
import { AppIcon } from "../components/ui/AppIcon";
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

type UrgencyFilter = "all" | "overdue" | "due_today" | "open";
type TaskSort = "due" | "priority" | "event";

const URGENCY_LABEL: Record<TaskUrgency, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const URGENCY_RANK: Record<TaskUrgency, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_LABEL: Record<KanbanColumnId, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export type BoardTasksStats = {
  assigned: number;
  dueToday: number;
  overdue: number;
  completed: number;
  completedPercent: number;
};

export type BoardTaskSections = {
  overdue: KanbanTask[];
  today: KanbanTask[];
  upcoming: KanbanTask[];
  completed: KanbanTask[];
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

function dueSortKey(task: KanbanTask): number {
  if (!task.due_date) {
    return Number.POSITIVE_INFINITY;
  }
  const ms = new Date(task.due_date).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function sortTasks(tasks: KanbanTask[], sort: TaskSort): KanbanTask[] {
  const copy = [...tasks];
  copy.sort((left, right) => {
    if (sort === "priority") {
      const urgencyDelta =
        URGENCY_RANK[getTaskUrgency(left)] - URGENCY_RANK[getTaskUrgency(right)];
      if (urgencyDelta !== 0) {
        return urgencyDelta;
      }
    }
    if (sort === "event") {
      const eventDelta = left.eventName.localeCompare(right.eventName);
      if (eventDelta !== 0) {
        return eventDelta;
      }
    }
    const dueDelta = dueSortKey(left) - dueSortKey(right);
    if (dueDelta !== 0) {
      return dueDelta;
    }
    return getTaskDisplayName(left).localeCompare(getTaskDisplayName(right));
  });
  return copy;
}

/** Split open work into Linear-style buckets; completed is separate. */
export function partitionBoardTasks(
  tasks: KanbanTask[],
  now: Date = new Date(),
): BoardTaskSections {
  const overdue: KanbanTask[] = [];
  const today: KanbanTask[] = [];
  const upcoming: KanbanTask[] = [];
  const completed: KanbanTask[] = [];

  for (const task of tasks) {
    if (getKanbanColumn(task) === "done") {
      completed.push(task);
      continue;
    }
    if (task.is_overdue) {
      overdue.push(task);
      continue;
    }
    if (task.due_date && isToday(new Date(task.due_date), now)) {
      today.push(task);
      continue;
    }
    upcoming.push(task);
  }

  return {
    overdue: sortTasks(overdue, "due"),
    today: sortTasks(today, "due"),
    upcoming: sortTasks(upcoming, "due"),
    completed: sortTasks(completed, "due"),
  };
}

function formatShortDue(isoDate: string | null, now = new Date()): string {
  if (!isoDate) {
    return "No due date";
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "No due date";
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

/** Quiet status control — plain text in the metadata line. */
function StatusMenu({
  task,
  busy,
  onSetColumn,
}: {
  task: KanbanTask;
  busy: boolean;
  onSetColumn: (column: KanbanColumnId) => void;
}) {
  const column = getKanbanColumn(task);

  return (
    <label
      className={["my-tasks-status-menu", `is-${column}`].join(" ")}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <select
        aria-label="Set task status"
        value={column}
        disabled={busy}
        onChange={(event) =>
          onSetColumn(event.target.value as KanbanColumnId)
        }
      >
        <option value="todo">{STATUS_LABEL.todo}</option>
        <option value="in_progress">{STATUS_LABEL.in_progress}</option>
        <option value="done">{STATUS_LABEL.done}</option>
      </select>
    </label>
  );
}

type TaskRowProps = {
  task: KanbanTask;
  completedView?: boolean;
  busy: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onMove: (column: KanbanColumnId) => void;
};

function TaskRow({
  task,
  completedView = false,
  busy,
  onOpen,
  onComplete,
  onMove,
}: TaskRowProps) {
  const title = getTaskDisplayName(task);
  const urgency = getTaskUrgency(task);
  const column = getKanbanColumn(task);
  const dueLabel = formatShortDue(task.due_date);
  const metaParts = [
    task.eventName,
    dueLabel,
    URGENCY_LABEL[urgency],
    !isSimpleKanbanTask(task) ? "Checklist" : null,
  ].filter(Boolean);

  return (
    <li>
      <article
        className={["my-tasks-row", column === "done" ? "is-complete" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="my-tasks-row__top">
          <div className="my-tasks-row__heading">
            <TaskCheck
              done={column === "done"}
              busy={busy}
              label={title}
              onComplete={completedView ? undefined : onComplete}
            />
            <button
              type="button"
              className="my-tasks-row__title"
              onClick={onOpen}
            >
              {title}
            </button>
          </div>
          <button
            type="button"
            className="my-tasks-row__open"
            onClick={onOpen}
          >
            Open →
          </button>
        </div>

        <p className="my-tasks-row__meta">
          {metaParts.map((part, index) => (
            <span key={`${part}-${index}`}>
              {index > 0 ? (
                <span className="my-tasks-row__sep" aria-hidden="true">
                  ·
                </span>
              ) : null}
              <span
                className={
                  part === dueLabel && task.is_overdue
                    ? "my-tasks-due is-overdue"
                    : undefined
                }
              >
                {part}
              </span>
            </span>
          ))}
          <span className="my-tasks-row__sep" aria-hidden="true">
            ·
          </span>
          <StatusMenu task={task} busy={busy} onSetColumn={onMove} />
        </p>
      </article>
    </li>
  );
}

type TaskSectionProps = {
  id: string;
  title: string;
  count: number;
  tone?: "overdue" | "today" | "upcoming" | "completed";
  emptyContent?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

function TaskSection({
  id,
  title,
  count,
  tone = "upcoming",
  emptyContent,
  collapsible = false,
  defaultOpen = true,
  children,
}: TaskSectionProps) {
  if (count === 0 && emptyContent == null) {
    return null;
  }

  const head = (
    <h2 id={id} className="my-tasks-section__title">
      {title}
      <span className="my-tasks-section__count"> ({count})</span>
    </h2>
  );

  const body =
    count === 0 ? (
      <p className="my-tasks-section__empty">{emptyContent}</p>
    ) : (
      <ul className="my-tasks-row-list">{children}</ul>
    );

  if (collapsible) {
    return (
      <details
        className={[
          "my-tasks-section",
          "my-tasks-section--collapsible",
          `is-${tone}`,
        ].join(" ")}
        open={defaultOpen}
      >
        <summary className="my-tasks-section__head my-tasks-section__summary">
          {head}
          <AppIcon
            icon={ChevronDown}
            size="xs"
            className="my-tasks-section__chevron text-label"
          />
        </summary>
        {body}
      </details>
    );
  }

  return (
    <section
      className={["my-tasks-section", `is-${tone}`].join(" ")}
      aria-labelledby={id}
    >
      <header className="my-tasks-section__head">{head}</header>
      {body}
    </section>
  );
}

export function BoardTasksPage() {
  const { member } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [eventFilter, setEventFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TaskSort>("due");

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

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (eventFilter !== "all" && task.eventId !== eventFilter) {
        return false;
      }
      if (query) {
        const haystack = `${getTaskDisplayName(task)} ${task.eventName}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      const column = getKanbanColumn(task);
      if (urgencyFilter === "open" && column === "done") {
        return false;
      }
      if (urgencyFilter === "overdue") {
        return column !== "done" && task.is_overdue;
      }
      if (urgencyFilter === "due_today") {
        return (
          column !== "done" &&
          Boolean(
            task.due_date &&
              isToday(new Date(task.due_date)) &&
              !task.is_overdue,
          )
        );
      }
      return true;
    });
  }, [tasks, eventFilter, urgencyFilter, search]);

  const sections = useMemo(() => {
    const partitioned = partitionBoardTasks(filteredTasks);
    return {
      overdue: sortTasks(partitioned.overdue, sort),
      today: sortTasks(partitioned.today, sort),
      upcoming: sortTasks(partitioned.upcoming, sort),
      completed: sortTasks(partitioned.completed, sort),
    };
  }, [filteredTasks, sort]);

  const filtersActive =
    urgencyFilter !== "all" || eventFilter !== "all" || search.trim() !== "";
  const openCount =
    sections.overdue.length + sections.today.length + sections.upcoming.length;

  if (!member) {
    return null;
  }

  function renderRows(sectionTasks: KanbanTask[], completedView = false) {
    return sectionTasks.map((task) => (
      <TaskRow
        key={task.id}
        task={task}
        completedView={completedView}
        busy={movingTaskId === task.id}
        onOpen={() => setSelectedTaskId(task.id)}
        onComplete={() => {
          void handleCompleteTask(task);
        }}
        onMove={(column) => {
          void handleMoveTask(task.id, column);
        }}
      />
    ));
  }

  return (
    <div className="my-tasks-page">
      <h1 className="sr-only">My Tasks</h1>

      {loadState.status === "ready" && tasks.length > 0 ? (
        <p className="my-tasks-summary" aria-label="My tasks summary">
          <span>Mine</span>
          <span className="my-tasks-summary__dot" aria-hidden="true">
            ·
          </span>
          <span>
            {stats.assigned} {stats.assigned === 1 ? "task" : "tasks"}
          </span>
          <span className="my-tasks-summary__dot" aria-hidden="true">
            ·
          </span>
          <span className={stats.overdue > 0 ? "is-overdue" : undefined}>
            {stats.overdue} overdue
          </span>
          <span className="my-tasks-summary__dot" aria-hidden="true">
            ·
          </span>
          <span>{stats.completedPercent}% complete</span>
        </p>
      ) : null}

      {loadState.status === "ready" && tasks.length > 0 ? (
        <>
          <div className="board-meetings-toolbar">
            <label className="board-meetings-search">
              <AppIcon icon={Search} size="sm" className="text-label" />
              <span className="sr-only">Search tasks</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks…"
              />
            </label>
            <div className="board-meetings-toolbar__actions">
              <button
                type="button"
                className="board-meetings-filter-btn"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <AppIcon
                  icon={SlidersHorizontal}
                  size="sm"
                  className="text-current"
                />
                Filter
                {filtersActive ? (
                  <span className="board-meetings-filter-btn__on">On</span>
                ) : null}
              </button>
              <label className="my-tasks-sort">
                <span className="sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as TaskSort)}
                >
                  <option value="due">Sort: Due date</option>
                  <option value="priority">Sort: Priority</option>
                  <option value="event">Sort: Event</option>
                </select>
              </label>
            </div>
          </div>

          {filtersOpen ? (
            <div
              className="board-meetings-filter-panel"
              aria-label="Task filters"
            >
              <div className="board-meetings-filter-field">
                <label htmlFor="my-tasks-filter-urgency">Urgency</label>
                <select
                  id="my-tasks-filter-urgency"
                  value={urgencyFilter}
                  onChange={(event) =>
                    setUrgencyFilter(event.target.value as UrgencyFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_today">Due today</option>
                  <option value="open">Open only</option>
                </select>
              </div>
              <div className="board-meetings-filter-field">
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
                className="board-meetings-filter-btn"
                onClick={() => {
                  setUrgencyFilter("all");
                  setEventFilter("all");
                  setSearch("");
                }}
              >
                Reset
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {moveError ? (
        <div role="alert" className="ds-alert-banner">
          {moveError}
        </div>
      ) : null}

      {loadState.status === "loading" ? (
        <p className="my-tasks-loading">Loading your tasks…</p>
      ) : null}

      {loadState.status === "error" ? (
        <div role="alert" className="ds-alert-banner p-8 text-center">
          {loadState.message}
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length === 0 ? (
        <div className="my-tasks-empty">
          <h3>No tasks assigned to you yet</h3>
          <p>
            {isRoleAtLeast(member.role, "board")
              ? "Create work from an event workspace — assigned tasks will show up here."
              : "When someone assigns you event work, it will show up here automatically."}
          </p>
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length > 0 ? (
        <div className="my-tasks-sections">
          {openCount === 0 && sections.completed.length === 0 ? (
            <div className="my-tasks-empty">
              <h3>No tasks match these filters</h3>
              <p>Reset filters or clear search to see your full list.</p>
            </div>
          ) : null}

          <TaskSection
            id="my-tasks-overdue"
            title="Overdue"
            count={sections.overdue.length}
            tone="overdue"
          >
            {renderRows(sections.overdue)}
          </TaskSection>

          <TaskSection
            id="my-tasks-today"
            title="Today"
            count={sections.today.length}
            tone="today"
          >
            {renderRows(sections.today)}
          </TaskSection>

          <TaskSection
            id="my-tasks-upcoming"
            title="Upcoming"
            count={sections.upcoming.length}
            tone="upcoming"
          >
            {renderRows(sections.upcoming)}
          </TaskSection>

          <TaskSection
            id="my-tasks-completed"
            title="Completed"
            count={sections.completed.length}
            tone="completed"
            collapsible
            defaultOpen={false}
          >
            {renderRows(sections.completed, true)}
          </TaskSection>
        </div>
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
