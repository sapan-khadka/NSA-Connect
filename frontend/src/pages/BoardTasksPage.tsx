import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BoardTaskKanban } from "../components/kanban/BoardTaskKanban";
import { KanbanTaskDetailPanel } from "../components/kanban/KanbanTaskDetailPanel";
import { useAuth } from "../context/useAuth";
import { isToday } from "../lib/calendar";
import {
  fetchMyEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
} from "../lib/event-tasks-api";
import { formatEventDateTime } from "../lib/format-datetime";
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
import { Card } from "../components/ui/Card";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; tasks: KanbanTask[] }
  | { status: "error"; message: string };

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

function taskDisplayTitle(task: KanbanTask): string {
  return isSimpleKanbanTask(task) ? task.title : (task.group_name ?? task.title);
}

function FocusTaskRow({
  task,
  onOpen,
}: {
  task: KanbanTask;
  onOpen: (taskId: number) => void;
}) {
  const dueLabel = task.is_overdue
    ? "Overdue"
    : task.due_date
      ? `Due today · ${formatEventDateTime(task.due_date)}`
      : "Due today";

  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-label">
          {task.eventName}
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
          {taskDisplayTitle(task)}
        </span>
      </span>
      <span
        className={[
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
          task.is_overdue
            ? "bg-overdue-surface text-overdue"
            : "bg-badge-teal-bg text-primary",
        ].join(" ")}
      >
        {dueLabel}
      </span>
    </button>
  );
}

export function BoardTasksPage() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

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

  const tasks = loadState.status === "ready" ? loadState.tasks : [];
  const stats = useMemo(() => calcBoardTasksStats(tasks), [tasks]);
  const focusTasks = useMemo(() => getFocusTasks(tasks), [tasks]);
  const selectedTask =
    selectedTaskId !== null
      ? tasks.find((task) => task.id === selectedTaskId) ?? null
      : null;

  if (!member) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section
        aria-label="My tasks summary"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-label"
      >
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {stats.assigned}
          </span>{" "}
          assigned
        </span>
        <span aria-hidden="true" className="text-label/40">
          ·
        </span>
        <span className={stats.overdue > 0 ? "text-overdue" : undefined}>
          <span className="font-semibold tabular-nums">
            {stats.overdue}
          </span>{" "}
          overdue
        </span>
        <span aria-hidden="true" className="text-label/40">
          ·
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {stats.dueToday}
          </span>{" "}
          due today
        </span>
        <span aria-hidden="true" className="text-label/40">
          ·
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {stats.completedPercent}%
          </span>{" "}
          done
        </span>
      </section>

      {focusTasks.length > 0 ? (
        <section
          aria-label="Focus"
          className="rounded-2xl border border-gray-200 bg-surface-card"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Focus</h2>
            <p className="mt-0.5 text-xs text-label">
              Overdue and due today — start here
            </p>
          </div>
          <ul className="divide-y divide-gray-100 px-1 py-1">
            {focusTasks.map((task) => (
              <li key={task.id}>
                <FocusTaskRow task={task} onOpen={setSelectedTaskId} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
        <Card
          as="div"
          padding="none"
          className="border border-dashed border-gray-200 p-10 text-center"
        >
          <p className="text-lg font-light tracking-subhead text-foreground">
            No tasks assigned to you yet
          </p>
          <p className="mt-2 text-label">
            {isRoleAtLeast(member.role, "board")
              ? "Use + Add task on a column to open the calendar and create work on an event."
              : "When a task manager assigns you work, it will show up here automatically."}
          </p>
        </Card>
      ) : null}

      {loadState.status === "ready" && tasks.length > 0 ? (
        <BoardTaskKanban
          tasks={tasks}
          hideAssignee
          onMoveTask={(taskId, targetColumn) => {
            void handleMoveTask(taskId, targetColumn);
          }}
          movingTaskId={movingTaskId}
          onOpenTask={setSelectedTaskId}
          onAddTask={() => {
            navigate("/events/calendar");
          }}
        />
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
