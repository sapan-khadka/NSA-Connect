import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { isRoleAtLeast } from "../lib/roles";
import { Card } from "../components/ui/Card";

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
      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid min-w-[14rem] grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-light tracking-headline text-foreground">{columnCounts.todo}</p>
              <p className="text-xs uppercase tracking-wide text-label">To do</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-light tracking-headline text-accent">
                {columnCounts.in_progress}
              </p>
              <p className="text-xs uppercase tracking-wide text-label">
                Active
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-light tracking-headline text-accent">
                {columnCounts.done}
              </p>
              <p className="text-xs uppercase tracking-wide text-label">Done</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm text-label">
            <span>
              {progress.done} of {progress.total} assigned tasks complete
            </span>
            <span className="font-semibold text-foreground">{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </Card>

      {moveError ? (
        <div
          role="alert"
          className="ds-alert-banner"
        >
          {moveError}
        </div>
      ) : null}

      {loadState.status === "loading" ? (
        <Card as="div" padding="none" className="p-16 text-center text-label">
          Loading your tasks…
        </Card>
      ) : null}

      {loadState.status === "error" ? (
        <div
          role="alert"
          className="ds-alert-banner p-8 text-center"
        >
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
