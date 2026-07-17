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
import {
  applyKanbanMoveLocally,
  getKanbanColumn,
  getKanbanMoveAction,
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
  const selectedTask =
    selectedTaskId !== null
      ? tasks.find((task) => task.id === selectedTaskId) ?? null
      : null;

  if (!member) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section
        aria-label="My tasks summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Card padding="md" className="text-center">
          <p className="home-stat-value">{stats.assigned}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-label">
            Assigned
          </p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="home-stat-value">{stats.dueToday}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-label">
            Due today
          </p>
        </Card>
        <Card padding="md" className="text-center">
          <p
            className={[
              "home-stat-value",
              stats.overdue > 0 ? "text-overdue" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {stats.overdue}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-label">
            Overdue
          </p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="home-stat-value">
            {stats.completed}
            <span className="ml-1 text-base font-normal text-label">
              ({stats.completedPercent}%)
            </span>
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-label">
            Completed
          </p>
        </Card>
      </section>

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

      {loadState.status === "ready" ? (
        <BoardTaskKanban
          tasks={tasks}
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
