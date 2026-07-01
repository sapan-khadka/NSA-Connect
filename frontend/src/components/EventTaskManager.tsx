import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  createEventTask,
  deleteEventTask,
  fetchEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../lib/event-tasks-api";
import type { PrepTaskResponse } from "../lib/events-api";
import { prepTaskToEventTask, eventTaskToPrepTask } from "../lib/task-adapters";
import { isRoleAtLeast } from "../lib/roles";
import {
  applyChecklistItemToggle,
  calcEventTasksProgress,
  replaceEventTaskInList,
} from "../lib/task-progress";
import { ChecklistTaskCard } from "./ChecklistTaskCard";
import { PrepProgressBar } from "./PrepProgressBar";

type EventTaskManagerProps = {
  eventId: number;
  eventName: string;
  member: MemberResponse | null;
  canManageSimple: boolean;
  canAssignChecklist: boolean;
  assignableMembers: MemberResponse[];
  fallbackChecklistTasks?: PrepTaskResponse[];
  onFallbackTasksChange?: (tasks: PrepTaskResponse[]) => void;
  refreshKey?: number;
};

const STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_BADGE_STYLES: Record<EventTaskStatus, string> = {
  todo: "bg-surface-muted text-foreground",
  in_progress: "bg-surface-card text-label",
  done: "bg-mint text-primary",
};

const STATUS_ORDER: EventTaskStatus[] = ["todo", "in_progress", "done"];

const EMPTY_FALLBACK_CHECKLIST: PrepTaskResponse[] = [];

export function EventTaskManager({
  eventId,
  eventName,
  member,
  canManageSimple,
  canAssignChecklist,
  assignableMembers,
  fallbackChecklistTasks = EMPTY_FALLBACK_CHECKLIST,
  onFallbackTasksChange,
  refreshKey = 0,
}: EventTaskManagerProps) {
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canFetchAll = member ? isRoleAtLeast(member.role, "board") : false;

  const syncFallbackTasks = useCallback(
    (nextTasks: EventTaskResponse[]) => {
      if (!onFallbackTasksChange) {
        return;
      }
      onFallbackTasksChange(
        nextTasks
          .filter((task) => task.task_kind === "checklist")
          .map((task) => eventTaskToPrepTask(task)),
      );
    },
    [onFallbackTasksChange],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        if (canFetchAll) {
          const response = await fetchEventTasks(eventId);
          if (!cancelled) {
            setTasks(response.tasks);
          }
        } else {
          const mapped = fallbackChecklistTasks.map((task) =>
            prepTaskToEventTask(task, { id: eventId, name: eventName }),
          );
          if (!cancelled) {
            setTasks(mapped);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error));
          setTasks([]);
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
  }, [canFetchAll, eventId, eventName, refreshKey, fallbackChecklistTasks]);

  function canToggleChecklist(task: EventTaskResponse): boolean {
    if (!member) {
      return false;
    }
    return (
      isRoleAtLeast(member.role, "board") || task.assignee_id === member.id
    );
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setActionError("Task title is required.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const created = await createEventTask(eventId, {
        title: trimmedTitle,
        description: description.trim() || undefined,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      setTasks((current) => [...current, created]);
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setDueDate("");
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(
    task: EventTaskResponse,
    status: EventTaskStatus,
  ) {
    setBusyTaskId(task.id);
    setActionError(null);

    try {
      const updated = await updateEventTask(task.id, { status });
      setTasks((current) => replaceEventTaskInList(current, updated));
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleDelete(task: EventTaskResponse) {
    if (
      !window.confirm(`Delete task "${task.title}"? This cannot be undone.`)
    ) {
      return;
    }

    setBusyTaskId(task.id);
    setActionError(null);

    try {
      await deleteEventTask(task.id);
      setTasks((current) => {
        const next = current.filter((entry) => entry.id !== task.id);
        syncFallbackTasks(next);
        return next;
      });
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleToggleChecklistItem(
    taskId: number,
    itemId: number,
    isCompleted: boolean,
  ) {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task || !canToggleChecklist(task)) {
      return;
    }

    const snapshot = tasks;
    setTogglingItemId(itemId);
    setTasks((current) =>
      replaceEventTaskInList(
        current,
        applyChecklistItemToggle(task, itemId, isCompleted),
      ),
    );

    try {
      const updated = await updateEventTaskChecklistItem(
        taskId,
        itemId,
        isCompleted,
      );
      setTasks((current) => {
        const next = replaceEventTaskInList(current, updated);
        syncFallbackTasks(next);
        return next;
      });
    } catch {
      setTasks(snapshot);
    } finally {
      setTogglingItemId(null);
    }
  }

  async function handleAssignChecklistTask(
    taskId: number,
    nextAssigneeId: number | null,
  ) {
    if (!canAssignChecklist) {
      return;
    }

    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    const snapshot = tasks;
    setAssigningTaskId(taskId);
    setTasks((current) =>
      replaceEventTaskInList(current, {
        ...task,
        assignee_id: nextAssigneeId,
      }),
    );

    try {
      const updated = await updateEventTask(taskId, {
        assignee_id: nextAssigneeId,
      });
      setTasks((current) => {
        const next = replaceEventTaskInList(current, updated);
        syncFallbackTasks(next);
        return next;
      });
    } catch {
      setTasks(snapshot);
    } finally {
      setAssigningTaskId(null);
    }
  }

  const checklistTasks = tasks.filter((task) => task.task_kind === "checklist");
  const simpleTasks = tasks.filter((task) => task.task_kind === "simple");
  const progress = calcEventTasksProgress(tasks);
  const showSection = canFetchAll || checklistTasks.length > 0;

  if (!showSection) {
    return null;
  }

  return (
    <section aria-label="Event tasks">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-label">
        Tasks
      </h4>

      {checklistTasks.length > 0 ? (
        <div className="mt-3">
          <PrepProgressBar progress={progress} label="Overall task progress" />
        </div>
      ) : null}

      {canManageSimple ? (
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="mt-3 space-y-2 rounded-card bg-surface-card p-3"
        >
          <p className="text-xs font-medium text-label">Add assigned task</p>
          <div>
            <label
              htmlFor="event-task-title"
              className="block text-xs font-medium text-label"
            >
              Title
            </label>
            <input
              id="event-task-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Book the venue"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="event-task-description"
              className="block text-xs font-medium text-label"
            >
              Details <span className="text-label">(optional)</span>
            </label>
            <textarea
              id="event-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="event-task-assignee"
                className="block text-xs font-medium text-label"
              >
                Assign to
              </label>
              <select
                id="event-task-assignee"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">Unassigned</option>
                {assignableMembers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="event-task-due"
                className="block text-xs font-medium text-label"
              >
                Due <span className="text-label">(optional)</span>
              </label>
              <input
                id="event-task-due"
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || title.trim().length === 0}
            className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add task"}
          </button>
        </form>
      ) : null}

      {actionError ? (
        <p className="mt-2 ds-field-error">{actionError}</p>
      ) : null}

      {isLoading ? (
        <p className="mt-3 text-sm text-label">Loading tasks…</p>
      ) : loadError ? (
        <p className="mt-3 ds-field-error">{loadError}</p>
      ) : tasks.length === 0 ? (
        <p className="mt-3 text-sm text-label">No tasks for this event yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {checklistTasks.map((task) => (
            <ChecklistTaskCard
              key={task.id}
              task={task}
              canToggle={canToggleChecklist(task)}
              canAssign={canAssignChecklist}
              assignableMembers={assignableMembers}
              togglingItemId={togglingItemId}
              assigningTaskId={assigningTaskId}
              onToggleItem={(taskId, itemId, isCompleted) => {
                void handleToggleChecklistItem(taskId, itemId, isCompleted);
              }}
              onAssign={(taskId, nextAssigneeId) => {
                void handleAssignChecklistTask(taskId, nextAssigneeId);
              }}
            />
          ))}

          {simpleTasks.length > 0 ? (
            <ul className="space-y-3">
              {simpleTasks.map((task) => {
                const isBusy = busyTaskId === task.id;
                return (
                  <li
                    key={task.id}
                    className="rounded-md border border-gray-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="mt-1 text-sm text-label">
                            {task.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-label">
                          {task.assignee_name
                            ? `Assigned to ${task.assignee_name}`
                            : "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[task.status]}`}
                      >
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>

                    {task.completion_note ? (
                      <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-foreground">
                        Note: {task.completion_note}
                      </p>
                    ) : null}

                    {task.completion_photo_url ? (
                      <a
                        href={task.completion_photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block"
                      >
                        <img
                          src={task.completion_photo_url}
                          alt={`Completion photo for ${task.title}`}
                          className="h-20 w-20 rounded object-cover"
                        />
                      </a>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs text-label">
                        Status
                        <select
                          value={task.status}
                          disabled={isBusy}
                          onChange={(event) =>
                            void handleStatusChange(
                              task,
                              event.target.value as EventTaskStatus,
                            )
                          }
                          className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs focus:border-accent focus:outline-none disabled:opacity-60"
                        >
                          {STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>

                      {canManageSimple ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDelete(task)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-label transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
