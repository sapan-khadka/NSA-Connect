import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ChecklistTaskCard } from "../components/ChecklistTaskCard";
import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMyEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
  uploadTaskPhoto,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../lib/event-tasks-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { Card } from "./ui/Card";
import {
  applyChecklistItemToggle,
  replaceEventTaskInList,
} from "../lib/task-progress";

const STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_ORDER: EventTaskStatus[] = ["todo", "in_progress", "done"];

type MySimpleTaskCardProps = {
  task: EventTaskResponse;
  onUpdated: (task: EventTaskResponse) => void;
};

function MySimpleTaskCard({ task, onUpdated }: MySimpleTaskCardProps) {
  const [note, setNote] = useState(task.completion_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleStatusChange(status: EventTaskStatus) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await updateEventTask(task.id, { status }));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNote() {
    setBusy(true);
    setError(null);
    try {
      onUpdated(
        await updateEventTask(task.id, { completion_note: note.trim() || null }),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const photoUrl = await uploadTaskPhoto(file);
      onUpdated(
        await updateEventTask(task.id, { completion_photo_url: photoUrl }),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <li className="rounded-md border border-gray-200 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{task.title}</p>
          <p className="mt-1 text-sm text-label">{task.event_name}</p>
          {task.description ? (
            <p className="mt-1 text-sm text-label">{task.description}</p>
          ) : null}
          {task.due_date ? (
            <p className="mt-1 text-xs text-label">
              Due {formatEventDateTime(task.due_date)}
            </p>
          ) : null}
        </div>
        <label className="text-xs text-label">
          Status
          <select
            value={task.status}
            disabled={busy}
            onChange={(event) =>
              void handleStatusChange(event.target.value as EventTaskStatus)
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
      </div>

      <div className="mt-3">
        <label
          htmlFor={`task-note-${task.id}`}
          className="block text-xs font-medium text-label"
        >
          Completion note <span className="text-label">(optional)</span>
        </label>
        <textarea
          id={`task-note-${task.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSaveNote()}
          className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save note
        </button>
      </div>

      <div className="mt-3">
        <label
          htmlFor={`task-photo-${task.id}`}
          className="block text-xs font-medium text-label"
        >
          Completion photo <span className="text-label">(optional)</span>
        </label>
        {task.completion_photo_url ? (
          <a
            href={task.completion_photo_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block"
          >
            <img
              src={task.completion_photo_url}
              alt={`Completion photo for ${task.title}`}
              className="h-24 w-24 rounded object-cover"
            />
          </a>
        ) : null}
        <input
          id={`task-photo-${task.id}`}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => void handlePhotoChange(event)}
          className="mt-1 block w-full text-sm text-label file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20 disabled:opacity-60"
        />
      </div>

      {error ? <p className="mt-2 ds-field-error">{error}</p> : null}
    </li>
  );
}

export function MyEventTasks() {
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchMyEventTasks();
        if (!cancelled) {
          setTasks(response.tasks);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
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
  }, []);

  function handleUpdated(updated: EventTaskResponse) {
    setTasks((current) => replaceEventTaskInList(current, updated));
  }

  async function handleToggleChecklistItem(
    taskId: number,
    itemId: number,
    isCompleted: boolean,
  ) {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
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
      handleUpdated(updated);
    } catch {
      setTasks(snapshot);
    } finally {
      setTogglingItemId(null);
    }
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-light tracking-subhead text-foreground">My tasks</h2>
          <p className="mt-1 text-sm text-label">
            Assigned checklist and action items. Update progress as you work.
          </p>
        </div>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
          {tasks.length}
        </span>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-label">Loading your tasks…</p>
      ) : error ? (
        <p className="mt-6 ds-field-error">{error}</p>
      ) : tasks.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-label">
          No tasks assigned to you.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {tasks.map((task) =>
            task.task_kind === "checklist" ? (
              <li key={task.id}>
                <ChecklistTaskCard
                  task={task}
                  canToggle
                  canAssign={false}
                  assignableMembers={[]}
                  togglingItemId={togglingItemId}
                  onToggleItem={(taskId, itemId, isCompleted) => {
                    void handleToggleChecklistItem(taskId, itemId, isCompleted);
                  }}
                  onAssign={() => undefined}
                />
              </li>
            ) : (
              <MySimpleTaskCard
                key={task.id}
                task={task}
                onUpdated={handleUpdated}
              />
            ),
          )}
        </ul>
      )}
    </Card>
  );
}
