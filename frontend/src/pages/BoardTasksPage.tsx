import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { BoardTaskKanban } from "../components/kanban/BoardTaskKanban";
import { useAuth } from "../context/useAuth";
import { fetchEvents } from "../lib/events-api";
import {
  fetchEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
  type EventTaskResponse,
} from "../lib/event-tasks-api";
import {
  applyKanbanMoveLocally,
  getKanbanColumn,
  getKanbanMoveAction,
  type KanbanColumnId,
  type KanbanTask,
} from "../lib/kanban-status";
import { calcEventTasksProgress } from "../lib/task-progress";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; tasks: KanbanTask[] }
  | { status: "error"; message: string };

function buildKanbanTask(
  task: EventTaskResponse,
  event: { id: number; name: string; starts_at: string },
): KanbanTask {
  return {
    ...task,
    eventId: event.id,
    eventName: event.name,
    eventStartsAt: event.starts_at,
  };
}

export function BoardTasksPage() {
  const { member } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoadState({ status: "loading" });

    try {
      const { events } = await fetchEvents();
      const upcomingEvents = events
        .filter((event) => new Date(event.starts_at) >= new Date())
        .sort(
          (left, right) =>
            new Date(left.starts_at).getTime() -
            new Date(right.starts_at).getTime(),
        )
        .slice(0, 8);

      const taskGroups = await Promise.all(
        upcomingEvents.map(async (event) => {
          const response = await fetchEventTasks(event.id);
          return response.tasks
            .filter((task) => task.task_kind === "checklist")
            .map((task) => buildKanbanTask(task, event));
        }),
      );

      setLoadState({ status: "ready", tasks: taskGroups.flat() });
    } catch {
      setLoadState({
        status: "error",
        message: "Unable to load board tasks.",
      });
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

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
        action.type === "bulk_complete"
          ? await updateEventTask(taskId, { is_complete: action.value })
          : await updateEventTaskChecklistItem(
              taskId,
              action.itemId,
              action.value,
            );

      setLoadState({
        status: "ready",
        tasks: previousTasks.map((entry) =>
          entry.id === taskId
            ? buildKanbanTask(updatedTask, {
                id: task.eventId,
                name: task.eventName,
                starts_at: task.eventStartsAt,
              })
            : entry,
        ),
      });
    } catch {
      setMoveError("Unable to update task. Changes were reverted.");
      setLoadState({ status: "ready", tasks: previousTasks });
    } finally {
      setMovingTaskId(null);
    }
  }

  if (!member) {
    return null;
  }

  const tasks = loadState.status === "ready" ? loadState.tasks : [];
  const progress = calcEventTasksProgress(tasks);
  const columnCounts = {
    todo: tasks.filter((task) => getKanbanColumn(task) === "todo").length,
    in_progress: tasks.filter(
      (task) => getKanbanColumn(task) === "in_progress",
    ).length,
    done: tasks.filter((task) => getKanbanColumn(task) === "done").length,
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary via-[#16213e] to-[#0f3460] p-8 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent/90">
              Board command center
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Task board</h1>
            <p className="mt-3 text-base text-white/75">
              Drag checklist tasks across To do, In progress, and Done to keep
              every event on track.
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
            <span>Overall checklist progress</span>
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
          Loading board tasks...
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
          <p className="text-lg font-semibold text-primary">No checklist tasks yet</p>
          <p className="mt-2 text-gray-500">
            Add checklist tasks to upcoming events to populate this board.
          </p>
          <Link
            to="/events/upcoming"
            className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            View upcoming events
          </Link>
        </div>
      ) : null}

      {loadState.status === "ready" && tasks.length > 0 ? (
        <BoardTaskKanban
          tasks={tasks}
          onMoveTask={(taskId, targetColumn) => {
            void handleMoveTask(taskId, targetColumn);
          }}
          movingTaskId={movingTaskId}
        />
      ) : null}
    </div>
  );
}
