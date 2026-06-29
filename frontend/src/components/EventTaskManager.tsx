import { useEffect, useState, type FormEvent } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  createEventTask,
  deleteEventTask,
  fetchEventTasks,
  updateEventTask,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../lib/event-tasks-api";

type EventTaskManagerProps = {
  eventId: number;
  canManage: boolean;
  assignableMembers: MemberResponse[];
};

const STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_BADGE_STYLES: Record<EventTaskStatus, string> = {
  todo: "border-gray-200 bg-gray-50 text-gray-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-800",
  done: "border-green-200 bg-green-50 text-green-800",
};

const STATUS_ORDER: EventTaskStatus[] = ["todo", "in_progress", "done"];

export function EventTaskManager({
  eventId,
  canManage,
  assignableMembers,
}: EventTaskManagerProps) {
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetchEventTasks(eventId);
        if (!cancelled) {
          setTasks(response.tasks);
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
  }, [eventId]);

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
      setTasks((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
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
      setTasks((current) => current.filter((entry) => entry.id !== task.id));
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <section aria-label="Event tasks">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Assigned tasks
      </h4>

      {canManage ? (
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="mt-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3"
        >
          <div>
            <label
              htmlFor="event-task-title"
              className="block text-xs font-medium text-gray-600"
            >
              Task
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
              className="block text-xs font-medium text-gray-600"
            >
              Details <span className="text-gray-400">(optional)</span>
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
                className="block text-xs font-medium text-gray-600"
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
                className="block text-xs font-medium text-gray-600"
              >
                Due <span className="text-gray-400">(optional)</span>
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
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add task"}
          </button>
        </form>
      ) : null}

      {actionError ? (
        <p className="mt-2 text-sm text-red-600">{actionError}</p>
      ) : null}

      {isLoading ? (
        <p className="mt-3 text-sm text-gray-500">Loading tasks…</p>
      ) : loadError ? (
        <p className="mt-3 text-sm text-red-600">{loadError}</p>
      ) : tasks.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">No tasks assigned yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {tasks.map((task) => {
            const isBusy = busyTaskId === task.id;
            return (
              <li
                key={task.id}
                className="rounded-md border border-gray-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {task.title}
                    </p>
                    {task.description ? (
                      <p className="mt-1 text-sm text-gray-600">
                        {task.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">
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
                  <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">
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
                  <label className="text-xs text-gray-500">
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

                  {canManage ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleDelete(task)}
                      className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
