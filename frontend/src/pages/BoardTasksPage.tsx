import { useCallback, useEffect, useMemo, useState } from "react";

import { BoardTaskKanban } from "../components/kanban/BoardTaskKanban";
import { KanbanTaskDetailPanel } from "../components/kanban/KanbanTaskDetailPanel";
import { useAuth } from "../context/useAuth";
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

type LoadState =
  | { status: "loading" }
  | { status: "ready"; tasks: KanbanTask[] }
  | { status: "error"; message: string };

function calcPersonalProgress(tasks: KanbanTask[]) {
  if (tasks.length === 0) {
    return { percent: 0, done: 0, total: 0 };
  }

  const done = tasks.filter((task) => getKanbanColumn(task) === "done").length;
  return {
    done,
    total: tasks.length,
    percent: Math.round((done / tasks.length) * 100),
  };
}

export function BoardTasksPage() {
  const { member } = useAuth();
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
  const progress = useMemo(() => calcPersonalProgress(tasks), [tasks]);
  const selectedTask =
    selectedTaskId !== null
      ? tasks.find((task) => task.id === selectedTaskId) ?? null
      : null;

  const columnCounts = {
    todo: tasks.filter((task) => getKanbanColumn(task) === "todo").length,
    in_progress: tasks.filter(
      (task) => getKanbanColumn(task) === "in_progress",
    ).length,
    done: tasks.filter((task) => getKanbanColumn(task) === "done").length,
  };

  if (!member) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary via-[#16213e] to-[#0f3460] p-8 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent/90">
              My work
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Task board</h1>
            <p className="mt-3 text-base text-white/75">
              Tasks assigned to you — drag between To do, In progress, and Done.
              Open a card to add a completion note or photo.
            </p>
          </div>

          <div className="grid min-w-[14rem] grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
            <div className="text-center">
              <p className="text-2xl font-bold">{columnCounts.todo}</p>
              <p className="text-xs uppercase tracking-wide text-white/70">To do</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-300">
                {columnCounts.in_progress}
              </p>
              <p className="text-xs uppercase tracking-wide text-white/70">
                Active
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-300">
                {columnCounts.done}
              </p>
              <p className="text-xs uppercase tracking-wide text-white/70">Done</p>
            </div>
          </div>
        </div>

        <div className="relative mt-8">
          <div className="mb-2 flex items-center justify-between text-sm text-white/70">
            <span>
              {progress.done} of {progress.total} assigned tasks complete
            </span>
            <span className="font-semibold text-white">{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-orange-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </section>

      {moveError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {moveError}
        </div>
      ) : null}

      {loadState.status === "loading" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-gray-500 shadow-sm">
          Loading your tasks…
        </div>
      ) : null}

      {loadState.status === "error" ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800"
        >
          {loadState.message}
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
          <p className="text-lg font-semibold text-primary">
            No tasks assigned to you yet
          </p>
          <p className="mt-2 text-gray-500">
            When a task manager assigns you work — for example the treasurer or
            event manager — it will show up here automatically.
          </p>
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length > 0 ? (
        <BoardTaskKanban
          tasks={tasks}
          onMoveTask={(taskId, targetColumn) => {
            void handleMoveTask(taskId, targetColumn);
          }}
          movingTaskId={movingTaskId}
          onOpenTask={setSelectedTaskId}
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
