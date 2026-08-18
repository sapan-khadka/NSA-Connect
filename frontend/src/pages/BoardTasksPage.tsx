import {
  Check,
  ChevronDown,
  Circle,
  CircleDot,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";

import { KanbanTaskDetailPanel } from "../components/kanban/KanbanTaskDetailPanel";
import { AppIcon } from "../components/ui/AppIcon";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { isToday } from "../lib/calendar";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
import {
  createEventTask,
  fetchMyEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
} from "../lib/event-tasks-api";
import { fetchUpcomingEvents } from "../lib/events-api";
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
import { canManageEventTasks } from "../lib/roles";

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

const STATUS_ICON = {
  todo: Circle,
  in_progress: CircleDot,
  done: Check,
} as const;

const STATUS_OPTIONS: KanbanColumnId[] = ["todo", "in_progress", "done"];

/** Quiet status control — icon menu in the metadata line. */
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
  const StatusIcon = STATUS_ICON[column];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={["my-tasks-status-menu", `is-${column}`].join(" ")}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="my-tasks-status-menu__trigger"
        aria-label="Set task status"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        <AppIcon
          icon={StatusIcon}
          size="xs"
          className="my-tasks-status-menu__icon"
        />
        <span>{STATUS_LABEL[column]}</span>
      </button>
      {open ? (
        <div id={menuId} role="menu" className="my-tasks-status-menu__list">
          {STATUS_OPTIONS.map((option) => {
            const OptionIcon = STATUS_ICON[option];
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={option === column}
                className={[
                  "my-tasks-status-menu__item",
                  `is-${option}`,
                  option === column ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setOpen(false);
                  if (option !== column) {
                    onSetColumn(option);
                  }
                }}
              >
                <AppIcon
                  icon={OptionIcon}
                  size="xs"
                  className="my-tasks-status-menu__icon"
                />
                {STATUS_LABEL[option]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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
    column !== "done" ? URGENCY_LABEL[urgency] : null,
    !isSimpleKanbanTask(task) ? "Checklist" : null,
  ].filter(Boolean) as string[];

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
            <div className="my-tasks-row__copy">
              <button
                type="button"
                className="my-tasks-row__title"
                title={task.eventName}
                onClick={onOpen}
              >
                {title}
              </button>
              <div className="my-tasks-row__meta">
                {metaParts.join(" · ")}
                {metaParts.length > 0 ? " · " : null}
                <StatusMenu task={task} busy={busy} onSetColumn={onMove} />
              </div>
            </div>
          </div>
          <time
            className={[
              "my-tasks-row__due",
              task.is_overdue && column !== "done" ? "is-overdue" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            dateTime={task.due_date ?? undefined}
          >
            {dueLabel}
          </time>
        </div>
      </article>
    </li>
  );
}

type TaskSectionProps = {
  id: string;
  title: string;
  count: number;
  tone?: "overdue" | "today" | "upcoming" | "completed";
  flush?: boolean;
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
  flush = false,
  emptyContent,
  collapsible = false,
  defaultOpen = true,
  children,
}: TaskSectionProps) {
  if (count === 0 && emptyContent == null) {
    return null;
  }

  const head = (
    <div className="event-command-section-head">
      <h2 id={id} className="event-command-kicker">
        {title}
      </h2>
      <span className="my-tasks-section__trail">
        <span className="event-command-count" aria-label={`${count} tasks`}>
          {count}
        </span>
        {collapsible ? (
          <AppIcon
            icon={ChevronDown}
            size="xs"
            className="my-tasks-section__chevron text-label"
          />
        ) : null}
      </span>
    </div>
  );

  const body =
    count === 0 ? (
      <p className="event-command-stat">{emptyContent}</p>
    ) : (
      <ul className="my-tasks-row-list">{children}</ul>
    );

  const sectionClass = [
    "event-command-section",
    "my-tasks-section",
    flush ? "is-flush" : "",
    `is-${tone}`,
  ]
    .filter(Boolean)
    .join(" ");

  if (collapsible) {
    return (
      <details
        className={[sectionClass, "my-tasks-section--collapsible"].join(" ")}
        open={defaultOpen}
      >
        <summary className="my-tasks-section__summary">{head}</summary>
        {body}
      </details>
    );
  }

  return (
    <section className={sectionClass} aria-labelledby={id}>
      {head}
      {body}
    </section>
  );
}

export function BoardTasksPage() {
  const { member } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [eventFilter, setEventFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TaskSort>("due");
  const [composing, setComposing] = useState(false);
  const [composeEvents, setComposeEvents] = useState<
    { id: number; name: string }[]
  >([]);
  const [composeEventId, setComposeEventId] = useState<number | "">("");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeDue, setComposeDue] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeEventsLoading, setComposeEventsLoading] = useState(false);

  const canCreateTask = Boolean(
    member && canManageEventTasks(member.role, member.position),
  );

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

  const openComposer = useCallback(() => {
    setComposing(true);
    setComposeError(null);
  }, []);

  useEffect(() => {
    if (searchParams.get("create") !== "1" || !canCreateTask) {
      return;
    }
    openComposer();
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [canCreateTask, openComposer, searchParams, setSearchParams]);

  useEffect(() => {
    if (!composing || !canCreateTask) {
      return;
    }

    let cancelled = false;
    setComposeEventsLoading(true);
    void fetchUpcomingEvents({ limit: 40 })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const events = response.events.map((event) => ({
          id: event.id,
          name: event.name,
        }));
        setComposeEvents(events);
        setComposeEventId((current) =>
          current === "" && events[0] ? events[0].id : current,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setComposeError("Unable to load events for new tasks.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setComposeEventsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [composing, canCreateTask]);

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

  function resetComposer() {
    setComposing(false);
    setComposeTitle("");
    setComposeDue("");
    setComposeError(null);
    setComposeBusy(false);
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !canCreateTask || composeEventId === "") {
      return;
    }

    const title = composeTitle.trim();
    if (!title) {
      setComposeError("Add a task title.");
      return;
    }

    setComposeBusy(true);
    setComposeError(null);

    try {
      const created = await createEventTask(composeEventId, {
        title,
        assignee_id: member.id,
        due_date: composeDue ? new Date(composeDue).toISOString() : null,
      });
      const kanbanTask = toKanbanTask(created);
      setLoadState((current) => {
        if (current.status !== "ready") {
          return {
            status: "ready",
            tasks: [kanbanTask],
          };
        }
        return {
          status: "ready",
          tasks: [kanbanTask, ...current.tasks],
        };
      });
      resetComposer();
    } catch (error) {
      setComposeError(getApiErrorMessage(error));
      setComposeBusy(false);
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

  const openCount =
    sections.overdue.length + sections.today.length + sections.upcoming.length;
  const openTaskCount = Math.max(0, stats.assigned - stats.completed);
  const firstOpenSection =
    sections.overdue.length > 0
      ? "overdue"
      : sections.today.length > 0
        ? "today"
        : sections.upcoming.length > 0
          ? "upcoming"
          : null;

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
    <div className="my-tasks-page event-command">
      <header className="event-command-header">
        <div className="event-command-title-row">
          <h1 className="event-command-title">Tasks</h1>
          {canCreateTask && !composing ? (
            <button
              type="button"
              className={EVENT_MANAGE_ACTION_LINK}
              onClick={openComposer}
            >
              New task
            </button>
          ) : null}
        </div>
        <p className="event-command-meta">
          Work assigned to you across events.
        </p>
        {loadState.status === "ready" && tasks.length > 0 ? (
          <>
            <div className="event-command-actions my-tasks-filters">
              <label className="my-tasks-filter my-tasks-filter--search">
                <span className="sr-only">Search tasks</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks…"
                />
              </label>
              <label className="my-tasks-filter">
                <span className="sr-only">Event</span>
                <select
                  aria-label="Event"
                  value={eventFilter === "all" ? "all" : String(eventFilter)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEventFilter(value === "all" ? "all" : Number(value));
                  }}
                >
                  <option value="all">All events</option>
                  {eventOptions.map((eventOption) => (
                    <option key={eventOption.id} value={eventOption.id}>
                      {eventOption.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="my-tasks-filter">
                <span className="sr-only">Show</span>
                <select
                  aria-label="Show"
                  value={urgencyFilter}
                  onChange={(event) =>
                    setUrgencyFilter(event.target.value as UrgencyFilter)
                  }
                >
                  <option value="all">All tasks</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_today">Due today</option>
                  <option value="open">Open only</option>
                </select>
              </label>
              <label className="my-tasks-filter">
                <span className="sr-only">Sort</span>
                <select
                  aria-label="Sort"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as TaskSort)
                  }
                >
                  <option value="due">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="event">Event</option>
                </select>
              </label>
            </div>
            <div
              className="event-command-metrics"
              aria-label="My tasks summary"
            >
              <section className="event-command-metric">
                <p className="event-command-metric-value">{openTaskCount}</p>
                <span className="event-command-metric-label">Open</span>
              </section>
              <section
                className={[
                  "event-command-metric",
                  stats.overdue > 0 ? "is-overdue" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="event-command-metric-value">{stats.overdue}</p>
                <span className="event-command-metric-label">Overdue</span>
              </section>
              <section className="event-command-metric">
                <p className="event-command-metric-value">{stats.dueToday}</p>
                <span className="event-command-metric-label">Due today</span>
              </section>
              <section className="event-command-metric">
                <p className="event-command-metric-value">
                  {stats.completedPercent}%
                </p>
                <span className="event-command-metric-label">Completion</span>
              </section>
            </div>
          </>
        ) : null}
      </header>

      {loadState.status === "ready" && composing ? (
        <form
          className="my-tasks-compose"
          onSubmit={(event) => {
            void handleCreateTask(event);
          }}
        >
          <div className="my-tasks-compose__fields">
            <label className="my-tasks-compose__field">
              <span>Event</span>
              <select
                value={composeEventId === "" ? "" : String(composeEventId)}
                disabled={composeBusy || composeEventsLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  setComposeEventId(value === "" ? "" : Number(value));
                }}
                required
              >
                <option value="" disabled>
                  {composeEventsLoading ? "Loading events…" : "Select event"}
                </option>
                {composeEvents.map((eventOption) => (
                  <option key={eventOption.id} value={eventOption.id}>
                    {eventOption.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="my-tasks-compose__field my-tasks-compose__title">
              <span>Task</span>
              <input
                type="text"
                value={composeTitle}
                onChange={(event) => setComposeTitle(event.target.value)}
                placeholder="What needs to get done?"
                disabled={composeBusy}
                autoFocus
                required
              />
            </label>
            <label className="my-tasks-compose__field">
              <span>Due</span>
              <input
                type="date"
                value={composeDue}
                onChange={(event) => setComposeDue(event.target.value)}
                disabled={composeBusy}
              />
            </label>
          </div>
          {composeError ? (
            <p className="my-tasks-compose__error" role="alert">
              {composeError}
            </p>
          ) : null}
          <div className="my-tasks-compose__actions">
            <button
              type="submit"
              className="event-command-btn event-command-btn--primary"
              disabled={composeBusy || composeEventsLoading}
            >
              {composeBusy ? "Creating…" : "Create task"}
            </button>
            <button
              type="button"
              className="event-command-btn"
              disabled={composeBusy}
              onClick={resetComposer}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {moveError ? (
        <div role="alert" className="ds-alert-banner">
          {moveError}
        </div>
      ) : null}

      {loadState.status === "loading" ? (
        <p className="event-command-stat">Loading your tasks…</p>
      ) : null}

      {loadState.status === "error" ? (
        <div role="alert" className="ds-alert-banner">
          {loadState.message}
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length === 0 ? (
        <p className="event-command-stat">
          {canCreateTask
            ? "No tasks assigned to you yet. Use New task to assign yourself work, or create tasks from an event workspace."
            : "No tasks assigned to you yet. When someone assigns you event work, it will show up here."}
        </p>
      ) : null}

      {loadState.status === "ready" && tasks.length > 0 ? (
        <div className="event-command-body" aria-label="Your tasks">
          {openCount === 0 && sections.completed.length === 0 ? (
            <p className="event-command-stat">
              No tasks match these filters. Try All events or All tasks.
            </p>
          ) : null}

          {openCount === 0 && sections.completed.length > 0 ? (
            <p className="event-command-stat">Nothing open right now.</p>
          ) : null}

          <TaskSection
            id="my-tasks-overdue"
            title="Overdue"
            count={sections.overdue.length}
            tone="overdue"
            flush={firstOpenSection === "overdue"}
          >
            {renderRows(sections.overdue)}
          </TaskSection>

          <TaskSection
            id="my-tasks-today"
            title="Today"
            count={sections.today.length}
            tone="today"
            flush={firstOpenSection === "today"}
          >
            {renderRows(sections.today)}
          </TaskSection>

          <TaskSection
            id="my-tasks-upcoming"
            title="Upcoming"
            count={sections.upcoming.length}
            tone="upcoming"
            flush={firstOpenSection === "upcoming"}
          >
            {renderRows(sections.upcoming)}
          </TaskSection>

          <TaskSection
            id="my-tasks-completed"
            title="Completed"
            count={sections.completed.length}
            tone="completed"
            collapsible
            defaultOpen={openCount === 0}
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
