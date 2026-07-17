import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Trash2 } from "lucide-react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  createEventTask,
  deleteEventTask,
  fetchEventTasks,
  fetchMyEventTasks,
  updateEventTask,
  updateEventTaskChecklistItem,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../lib/event-tasks-api";
import type { PrepTaskResponse } from "../lib/events-api";
import type { EventTaskDraft } from "../lib/event-task-draft";
import { fetchAssignableMembers } from "../lib/members-api";
import { TASK_STATUS_LABELS } from "../lib/member-workspace-responsibilities";
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
  canCreateTasks?: boolean;
  canAssignChecklist: boolean;
  assignableMembers: MemberResponse[];
  fallbackChecklistTasks?: PrepTaskResponse[];
  onFallbackTasksChange?: (tasks: PrepTaskResponse[]) => void;
  refreshKey?: number;
  taskDraft?: EventTaskDraft | null;
  onTaskDraftApplied?: () => void;
};

const STATUS_BADGE_STYLES: Record<EventTaskStatus, string> = {
  todo: "bg-surface-muted text-foreground",
  in_progress: "bg-accent/10 text-accent",
  done: "bg-mint text-primary",
};

const STATUS_ORDER: EventTaskStatus[] = ["todo", "in_progress", "done"];

const EMPTY_FALLBACK_CHECKLIST: PrepTaskResponse[] = [];

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function calcTaskCompletionSummary(tasks: EventTaskResponse[]): {
  completed: number;
  total: number;
} {
  const total = tasks.length;
  const completed = tasks.filter((task) =>
    task.task_kind === "simple" ? task.status === "done" : task.is_complete,
  ).length;

  return { completed, total };
}

function AssigneeAvatar({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent"
    >
      {name ? getInitials(name) : "?"}
    </span>
  );
}

function TaskStatusPill({
  status,
  disabled,
  onChange,
}: {
  status: EventTaskStatus;
  disabled: boolean;
  onChange: (status: EventTaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${STATUS_BADGE_STYLES[status]}`}
      >
        {TASK_STATUS_LABELS[status]}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[8.5rem] ds-card py-1"
        >
          {STATUS_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (option !== status) {
                  onChange(option);
                }
              }}
              className={[
                "block w-full px-3 py-2 text-left text-xs transition-colors",
                option === status
                  ? "bg-accent/5 font-medium text-accent"
                  : "text-foreground hover:bg-surface-muted",
              ].join(" ")}
            >
              {TASK_STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SimpleTaskRow({
  task,
  isBusy,
  canManageSimple,
  onStatusChange,
  onDelete,
}: {
  task: EventTaskResponse;
  isBusy: boolean;
  canManageSimple: boolean;
  onStatusChange: (status: EventTaskStatus) => void;
  onDelete: () => void;
}) {
  return (
    <Card as="li" nested padding="none" className="p-3">
      <div className="flex items-center gap-3">
        <AssigneeAvatar name={task.assignee_name} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {task.title}
          </p>
          <p className="truncate text-xs text-label">
            {task.assignee_name ?? "Unassigned"}
          </p>
        </div>

        <TaskStatusPill
          status={task.status}
          disabled={isBusy}
          onChange={onStatusChange}
        />

        {canManageSimple ? (
          <button
            type="button"
            aria-label={`Delete task ${task.title}`}
            disabled={isBusy}
            onClick={onDelete}
            className="ds-icon-btn shrink-0 rounded-full p-1.5 text-label transition-colors hover:bg-surface-muted hover:text-overdue disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AppIcon icon={Trash2} size="sm" className="text-current" />
          </button>
        ) : null}
      </div>

      {task.description ? (
        <p className="mt-2 pl-12 text-sm text-label">{task.description}</p>
      ) : null}

      {task.completion_note ? (
        <p className="mt-2 rounded bg-gray-50 px-2 py-1 pl-12 text-xs text-foreground">
          Note: {task.completion_note}
        </p>
      ) : null}

      {task.completion_photo_url ? (
        <a
          href={task.completion_photo_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block pl-12"
        >
          <img
            src={task.completion_photo_url}
            alt={`Completion photo for ${task.title}`}
            className="h-20 w-20 rounded object-cover"
          />
        </a>
      ) : null}
    </Card>
  );
}

export function EventTaskManager({
  eventId,
  eventName,
  member,
  canManageSimple,
  canCreateTasks = true,
  canAssignChecklist,
  assignableMembers,
  fallbackChecklistTasks = EMPTY_FALLBACK_CHECKLIST,
  onFallbackTasksChange,
  refreshKey = 0,
  taskDraft = null,
  onTaskDraftApplied,
}: EventTaskManagerProps) {
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftAssigneeName, setDraftAssigneeName] = useState<string | null>(null);
  const [simpleAssignableMembers, setSimpleAssignableMembers] = useState<
    MemberResponse[]
  >([]);

  const canFetchAll = member ? isRoleAtLeast(member.role, "board") : false;

  useEffect(() => {
    if (!canFetchAll || !canCreateTasks) {
      setSimpleAssignableMembers([]);
      return;
    }

    let cancelled = false;
    void fetchAssignableMembers("all_approved")
      .then((response) => {
        if (!cancelled) {
          setSimpleAssignableMembers(response.members);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSimpleAssignableMembers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canFetchAll, canCreateTasks]);

  const assigneeOptions = (() => {
    const options = [...simpleAssignableMembers];
    if (
      assigneeId &&
      !options.some((candidate) => String(candidate.id) === assigneeId)
    ) {
      options.push({
        id: Number(assigneeId),
        full_name: draftAssigneeName ?? "Selected member",
        email: null,
        student_id: null,
        major: "",
        graduation_year: 2028,
        role: "general",
        status: "approved",
        position: "member",
      });
    }
    return options.sort((left, right) =>
      left.full_name.localeCompare(right.full_name),
    );
  })();

  const boardAssigneeOptions = assigneeOptions.filter((candidate) =>
    isRoleAtLeast(candidate.role, "board"),
  );
  const memberAssigneeOptions = assigneeOptions.filter(
    (candidate) => !isRoleAtLeast(candidate.role, "board"),
  );

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
          const mappedChecklist = fallbackChecklistTasks
            .filter(
              (task) => !member || task.assignee_id === member.id,
            )
            .map((task) =>
              prepTaskToEventTask(task, { id: eventId, name: eventName }),
            );

          let assignedForEvent: EventTaskResponse[] = [];
          if (member) {
            const mine = await fetchMyEventTasks();
            assignedForEvent = mine.tasks.filter(
              (task) => task.event_id === eventId,
            );
          }

          const assignedIds = new Set(assignedForEvent.map((task) => task.id));
          const checklistExtras = mappedChecklist.filter(
            (task) => !assignedIds.has(task.id),
          );

          if (!cancelled) {
            setTasks([...assignedForEvent, ...checklistExtras]);
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
  }, [
    canFetchAll,
    eventId,
    eventName,
    member,
    refreshKey,
    fallbackChecklistTasks,
  ]);

  useEffect(() => {
    if (!taskDraft) {
      return;
    }

    setTitle(taskDraft.title);
    setDescription(taskDraft.description);
    setAssigneeId(String(taskDraft.assigneeId));
    setDraftAssigneeName(taskDraft.assigneeName);
    setDueDate("");
    setShowAddForm(true);
    setActionError(null);
    onTaskDraftApplied?.();

    window.requestAnimationFrame(() => {
      addFormRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [taskDraft, onTaskDraftApplied]);

  function resetAddForm() {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setDraftAssigneeName(null);
    setDueDate("");
    setShowAddForm(false);
  }

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
      resetAddForm();
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
  const completionSummary = calcTaskCompletionSummary(tasks);
  const showSection = canFetchAll || tasks.length > 0;
  const allowCreateTasks = canManageSimple && canCreateTasks;

  if (!showSection) {
    return null;
  }

  return (
    <section aria-label="Event tasks" id="event-tasks-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-light tracking-subhead text-foreground">
            Tasks
          </h2>
          {completionSummary.total > 0 ? (
            <span className="text-sm text-label">
              {completionSummary.completed}/{completionSummary.total} done
            </span>
          ) : null}
        </div>

        {allowCreateTasks && !showAddForm ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            + Add task
          </Button>
        ) : null}
      </div>

      {canManageSimple && !canCreateTasks ? (
        <p className="mt-2 text-sm text-label">
          This event has ended — new tasks can&apos;t be added.
        </p>
      ) : null}

      {checklistTasks.length > 0 ? (
        <div className="mt-3">
          <PrepProgressBar progress={progress} label="Overall task progress" />
        </div>
      ) : null}

      {allowCreateTasks && showAddForm ? (
        <Card padding="none" className="mt-3 space-y-2 p-3">
          <form
            ref={addFormRef}
            onSubmit={(event) => void handleCreate(event)}
            className="space-y-2"
          >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-label">New task</p>
            <button
              type="button"
              onClick={resetAddForm}
              className="text-xs font-medium text-label transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
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
                {boardAssigneeOptions.length > 0 ? (
                  <optgroup label="Board">
                    {boardAssigneeOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.full_name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {memberAssigneeOptions.length > 0 ? (
                  <optgroup label="Members">
                    {memberAssigneeOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.full_name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
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

          <Button
            type="submit"
            disabled={isSubmitting || title.trim().length === 0}
            loading={isSubmitting}
            size="sm"
          >
            Add task
          </Button>
          </form>
        </Card>
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
            <ul className="space-y-2">
              {simpleTasks.map((task) => (
                <SimpleTaskRow
                  key={task.id}
                  task={task}
                  isBusy={busyTaskId === task.id}
                  canManageSimple={canManageSimple}
                  onStatusChange={(status) => {
                    void handleStatusChange(task, status);
                  }}
                  onDelete={() => void handleDelete(task)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
