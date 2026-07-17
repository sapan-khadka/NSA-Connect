import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ChecklistTaskCard } from "../ChecklistTaskCard";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  updateEventTask,
  updateEventTaskChecklistItem,
  uploadTaskPhoto,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../../lib/event-tasks-api";
import { formatEventDateTime } from "../../lib/format-datetime";
import { getTaskDisplayName } from "../../lib/home-tasks";
import { isSimpleKanbanTask, type KanbanTask } from "../../lib/kanban-status";
const STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

type KanbanTaskDetailPanelProps = {
  task: KanbanTask;
  onClose: () => void;
  onUpdated: (task: EventTaskResponse) => void;
};

export function KanbanTaskDetailPanel({
  task,
  onClose,
  onUpdated,
}: KanbanTaskDetailPanelProps) {
  const [note, setNote] = useState(task.completion_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNote(task.completion_note ?? "");
    setError(null);
    setSuccessMessage(null);
  }, [task]);

  async function persistUpdate(
    payload: Parameters<typeof updateEventTask>[1],
    successText?: string,
  ) {
    setBusy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await updateEventTask(task.id, payload);
      onUpdated(updated);
      if (successText) {
        setSuccessMessage(successText);
      }
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(status: EventTaskStatus) {
    await persistUpdate({ status });
  }

  async function handleSaveNote() {
    await persistUpdate(
      { completion_note: note.trim() || null },
      "Completion note saved.",
    );
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const photoUrl = await uploadTaskPhoto(file);
      const updated = await updateEventTask(task.id, {
        completion_photo_url: photoUrl,
      });
      onUpdated(updated);
      setSuccessMessage("Completion photo uploaded.");
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleToggleChecklistItem(
    taskId: number,
    itemId: number,
    isCompleted: boolean,
  ) {
    setTogglingItemId(itemId);
    setError(null);

    try {
      const updated = await updateEventTaskChecklistItem(
        taskId,
        itemId,
        isCompleted,
      );
      onUpdated(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setTogglingItemId(null);
    }
  }

  const title = getTaskDisplayName(task);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanban-task-detail-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {task.event_name}
            </p>
            <h2
              id="kanban-task-detail-title"
              className="mt-1 text-lg font-light tracking-subhead text-foreground"
            >
              {title}
            </h2>
            {task.due_date ? (
              <p className="mt-1 text-sm text-label">
                Due {formatEventDateTime(task.due_date)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-sm text-label transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {task.description ? (
            <p className="text-sm text-label">{task.description}</p>
          ) : null}

          {error ? (
            <p className="ds-alert-banner">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p className="ds-alert-banner">
              {successMessage}
            </p>
          ) : null}

          {isSimpleKanbanTask(task) ? (
            <label className="block text-sm text-label">
              Status
              <select
                value={task.status}
                disabled={busy}
                onChange={(event) =>
                  void handleStatusChange(event.target.value as EventTaskStatus)
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
              >
                {(Object.keys(STATUS_LABELS) as EventTaskStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : (
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
          )}

          <div>
            <label
              htmlFor={`kanban-task-note-${task.id}`}
              className="block text-sm font-medium text-foreground"
            >
              Completion note
            </label>
            <textarea
              id={`kanban-task-note-${task.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="What did you finish? Any handoff details?"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
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

          <div>
            <label
              htmlFor={`kanban-task-photo-${task.id}`}
              className="block text-sm font-medium text-foreground"
            >
              Completion photo
            </label>
            {task.completion_photo_url ? (
              <a
                href={task.completion_photo_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block"
              >
                <img
                  src={task.completion_photo_url}
                  alt={`Completion photo for ${title}`}
                  className="h-28 w-28 rounded-lg object-cover"
                />
              </a>
            ) : null}
            <input
              id={`kanban-task-photo-${task.id}`}
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => void handlePhotoChange(event)}
              className="mt-2 block w-full text-sm text-label file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20 disabled:opacity-60"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
