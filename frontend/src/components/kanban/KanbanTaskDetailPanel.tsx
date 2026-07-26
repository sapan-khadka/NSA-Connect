/**
 * Task completion modal — focused workflow (not a CRUD editor).
 * One primary action saves status + note + optional photo together.
 */

import { Check, ImagePlus, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { ChecklistTaskCard } from "../ChecklistTaskCard";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  updateEventTask,
  updateEventTaskChecklistItem,
  uploadTaskPhoto,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../../lib/event-tasks-api";
import { getTaskDisplayName, getTaskUrgency } from "../../lib/home-tasks";
import { isSimpleKanbanTask, type KanbanTask } from "../../lib/kanban-status";

type KanbanTaskDetailPanelProps = {
  task: KanbanTask;
  onClose: () => void;
  onUpdated: (task: EventTaskResponse) => void;
};

const STATUS_OPTIONS: Array<{
  id: EventTaskStatus;
  label: string;
}> = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

const URGENCY_LABEL = {
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

function formatDueLabel(isoDate: string | null): string | null {
  if (!isoDate) {
    return null;
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function KanbanTaskDetailPanel({
  task,
  onClose,
  onUpdated,
}: KanbanTaskDetailPanelProps) {
  const titleId = useId();
  const noteId = useId();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const prevStatusRef = useRef<EventTaskStatus | null>(null);

  // Completion-first: open with Done selected; user can switch if needed.
  const [status, setStatus] = useState<EventTaskStatus>("done");
  const [note, setNote] = useState(task.completion_note ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    task.completion_photo_url,
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);

  useEffect(() => {
    setStatus("done");
    setNote(task.completion_note ?? "");
    setPhotoUrl(task.completion_photo_url);
    setPendingFile(null);
    setPreviewUrl(null);
    setError(null);
    setSuccess(false);
    setClosing(false);
    setDragOver(false);
    prevStatusRef.current = null;
  }, [task]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy && !success) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, success, onClose]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Focus the note when status becomes Done (including open).
  useEffect(() => {
    const becameDone =
      status === "done" &&
      (prevStatusRef.current === null || prevStatusRef.current !== "done");
    prevStatusRef.current = status;
    if (!becameDone || success || busy) {
      return;
    }
    const timer = window.setTimeout(() => {
      noteRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [status, success, busy]);

  function stagePhoto(file: File | null) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (!file) {
      setPendingFile(null);
      setPreviewUrl(null);
      return;
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handlePhotoInput(event: ChangeEvent<HTMLInputElement>) {
    stagePhoto(event.target.files?.[0] ?? null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      stagePhoto(file);
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

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      let nextPhotoUrl = photoUrl;
      if (pendingFile) {
        nextPhotoUrl = await uploadTaskPhoto(pendingFile);
      }

      const payload: Parameters<typeof updateEventTask>[1] = {
        completion_note: note.trim() || null,
        completion_photo_url: nextPhotoUrl,
      };

      if (isSimpleKanbanTask(task)) {
        payload.status = status;
      } else if (status === "done") {
        payload.is_complete = true;
      }

      const updated = await updateEventTask(task.id, payload);
      onUpdated(updated);
      setBusy(false);
      setSuccess(true);
      window.setTimeout(() => {
        setClosing(true);
        window.setTimeout(() => {
          onClose();
        }, 200);
      }, 620);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setBusy(false);
    }
  }

  const title = getTaskDisplayName(task);
  const dueLabel = formatDueLabel(task.due_date);
  const urgency = getTaskUrgency(task);
  const displayPhoto = previewUrl ?? photoUrl;
  const primaryLabel = busy
    ? "Completing..."
    : success
      ? "Completed"
      : status === "done"
        ? "Complete"
        : "Save";
  const isSimple = isSimpleKanbanTask(task);
  const metaLine = [
    dueLabel ? `Due ${dueLabel}` : null,
    URGENCY_LABEL[urgency],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={[
        "task-complete-overlay",
        closing ? "is-closing" : "",
        success ? "is-success" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="presentation"
      onClick={() => {
        if (!busy && !success) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="task-complete-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="task-complete-modal__header">
          <div className="min-w-0 flex-1">
            <p className="task-complete-modal__eyebrow">
              <AppIcon icon={Check} size="xs" className="text-current" />
              Complete task
            </p>
            <h2 id={titleId} className="task-complete-modal__title">
              {title}
            </h2>
            <p className="task-complete-modal__event">{task.event_name}</p>
            <p className="task-complete-modal__meta-line">
              <span>{dueLabel ? `Due ${dueLabel}` : "No due date"}</span>
              <span className="task-complete-meta-sep" aria-hidden="true">
                ·
              </span>
              <span
                className={[
                  "task-complete-priority",
                  `is-${urgency}`,
                ].join(" ")}
              >
                <span className="task-complete-priority__dot" aria-hidden="true" />
                {URGENCY_LABEL[urgency]}
              </span>
            </p>
            <span className="sr-only">{metaLine}</span>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy || success}
            className="task-complete-modal__close"
            onClick={onClose}
          >
            <AppIcon icon={X} size="sm" className="text-current" />
          </button>
        </header>

        <div className="task-complete-modal__body">
          {error ? (
            <p className="ds-alert-banner" role="alert">
              {error}
            </p>
          ) : null}

          {success ? (
            <div className="task-complete-success" role="status">
              <span className="task-complete-success__icon" aria-hidden="true">
                <AppIcon icon={Check} size="md" className="text-current" />
              </span>
              <p className="task-complete-success__title">Completed</p>
            </div>
          ) : null}

          {!success && isSimple ? (
            <section aria-label="Status">
              <p className="task-complete-field-label">Status</p>
              <div
                className="task-complete-status-seg"
                role="group"
                aria-label="Task status"
              >
                {STATUS_OPTIONS.map((option) => {
                  const pressed = status === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={busy}
                      aria-pressed={pressed}
                      className={[
                        "task-complete-status-seg__btn",
                        pressed ? "is-active" : "",
                        pressed && option.id === "done" ? "is-done" : "",
                        pressed && option.id === "in_progress"
                          ? "is-progress"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setStatus(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!success && !isSimple ? (
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
          ) : null}

          {!success ? (
            <>
              <section>
                <label htmlFor={noteId} className="task-complete-field-label">
                  Describe what was completed{" "}
                  <span className="task-complete-optional">(optional)</span>
                </label>
                <textarea
                  id={noteId}
                  ref={noteRef}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  disabled={busy}
                  placeholder={
                    "Example:\nBooked Student Center ballroom.\nDeposit submitted.\nWaiting for confirmation."
                  }
                  className="task-complete-textarea"
                />
              </section>

              <section className="task-complete-photo-section">
                <p className="task-complete-field-label">
                  Upload proof{" "}
                  <span className="task-complete-optional">(optional)</span>
                </p>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                  className="sr-only"
                  disabled={busy}
                  onChange={handlePhotoInput}
                />
                {displayPhoto ? (
                  <div className="task-complete-photo-card">
                    <img
                      src={displayPhoto}
                      alt={`Completion photo for ${title}`}
                      className="task-complete-dropzone__image"
                    />
                    <div className="task-complete-photo-card__copy">
                      <p className="task-complete-photo-card__name-row">
                        <span
                          className="task-complete-photo-card__check"
                          aria-hidden="true"
                        >
                          <AppIcon
                            icon={Check}
                            size="xs"
                            className="text-current"
                          />
                        </span>
                        <span className="task-complete-photo-card__name">
                          {pendingFile?.name ?? "Completion photo"}
                        </span>
                      </p>
                      <div className="task-complete-photo-card__actions">
                        <button
                          type="button"
                          disabled={busy}
                          className="task-complete-photo-card__btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="task-complete-photo-card__btn is-danger"
                          onClick={() => {
                            stagePhoto(null);
                            setPhotoUrl(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor={fileInputId}
                    className={[
                      "task-complete-dropzone",
                      dragOver ? "is-dragover" : "",
                      busy ? "is-disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragOver(false);
                    }}
                    onDrop={handleDrop}
                  >
                    <div className="task-complete-dropzone__empty">
                      <span
                        className="task-complete-dropzone__icon"
                        aria-hidden="true"
                      >
                        <AppIcon
                          icon={ImagePlus}
                          size="sm"
                          className="text-current"
                        />
                      </span>
                      <p className="task-complete-dropzone__title">
                        Upload proof
                      </p>
                      <p className="task-complete-dropzone__hint">
                        Drag & drop or browse
                      </p>
                      <p className="task-complete-dropzone__formats">
                        PNG · JPG · HEIC
                      </p>
                    </div>
                  </label>
                )}
              </section>
            </>
          ) : null}
        </div>

        <footer className="task-complete-modal__footer">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || success}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={success}
            className={[
              "task-complete-modal__submit",
              success ? "is-success-state" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => void handleSubmit()}
          >
            <span className="task-complete-modal__submit-label">
              {!busy ? (
                <AppIcon icon={Check} size="xs" className="text-current" />
              ) : null}
              {primaryLabel}
            </span>
          </Button>
        </footer>
      </div>
    </div>
  );
}
