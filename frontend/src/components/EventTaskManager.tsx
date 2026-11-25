import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Plus, Trash2 } from "lucide-react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { avatarColorForPerson } from "../lib/avatar-color";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  createEventTask,
  deleteEventTask,
  fetchEventTasks,
  fetchMyEventTasks,
  saveEventTaskChecklist,
  updateEventTask,
  updateEventTaskChecklistItem,
  type EventTaskResponse,
  type EventTaskStatus,
} from "../lib/event-tasks-api";
import { addPrepTaskToEvent } from "../lib/events-api";
import { toLocalIsoDate } from "../lib/calendar";
import {
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_LABEL_LENGTH,
} from "../lib/draft-checklist";
import { buildCategoryDueDate } from "../lib/prep-task-create";
import type { PrepTaskResponse } from "../lib/events-api";
import type { EventTaskDraft } from "../lib/event-task-draft";
import { fetchAssignableMembers } from "../lib/members-api";
import { TASK_STATUS_LABELS } from "../lib/member-workspace-responsibilities";
import { prepTaskToEventTask, eventTaskToPrepTask } from "../lib/task-adapters";
import { isRoleAtLeast, memberSatisfiesMinRole } from "../lib/roles";
import {
  applyChecklistItemToggle,
  calcEventTasksProgress,
  replaceEventTaskInList,
} from "../lib/task-progress";
import {
  ChecklistTaskCard,
  type ChecklistStructureDraft,
} from "./ChecklistTaskCard";
import { PrepProgressBar } from "./PrepProgressBar";
import { inputFieldClassName } from "./ui/Input";

type EventTaskManagerProps = {
  eventId: number;
  eventName: string;
  member: MemberResponse | null;
  canManageSimple: boolean;
  canCreateTasks?: boolean;
  canAssignChecklist: boolean;
  eventStartsAt?: string | null;
  assignableMembers: MemberResponse[];
  fallbackChecklistTasks?: PrepTaskResponse[];
  onFallbackTasksChange?: (tasks: PrepTaskResponse[]) => void;
  refreshKey?: number;
  taskDraft?: EventTaskDraft | null;
  onTaskDraftApplied?: () => void;
};

const STATUS_BADGE_STYLES: Record<EventTaskStatus, string> = {
  todo: "bg-surface-muted text-foreground",
  in_progress: "bg-warning-surface text-warning",
  done: "bg-mint text-foreground",
};

const STATUS_ORDER: EventTaskStatus[] = ["todo", "in_progress", "done"];

const EMPTY_FALLBACK_CHECKLIST: PrepTaskResponse[] = [];

function categoryDueDateFromEventStart(startsAt: string): string {
  const start = new Date(startsAt);
  const hours = String(start.getHours()).padStart(2, "0");
  const minutes = String(start.getMinutes()).padStart(2, "0");
  return buildCategoryDueDate(
    toLocalIsoDate(start),
    `${hours}:${minutes}`,
    0,
    1,
  );
}

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

/** Shared initials chip — same look for Event Manage and Kanban cards. */
export function AssigneeAvatar({
  name,
  memberId = null,
}: {
  name: string | null;
  memberId?: number | null;
}) {
  const palette = avatarColorForPerson(memberId, name || "?");
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ backgroundColor: palette.background, color: palette.color }}
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
                  ? "bg-brand-soft font-medium text-foreground"
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
        <AssigneeAvatar
          name={task.assignee_name}
          memberId={task.assignee_id}
        />

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
  eventStartsAt = null,
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
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [checklistName, setChecklistName] = useState("");
  const [checklistItemLabels, setChecklistItemLabels] = useState<string[]>([""]);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [checklistDrafts, setChecklistDrafts] = useState<
    Record<number, Array<{ is_completed: boolean }>>
  >({});
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

  const canFetchAll = member ? memberSatisfiesMinRole(member, "board") : false;

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

  const handleStructurePreview = useCallback(
    (taskId: number, items: Array<{ is_completed: boolean }> | null) => {
      setChecklistDrafts((current) => {
        if (items === null) {
          if (!(taskId in current)) {
            return current;
          }
          const next = { ...current };
          delete next[taskId];
          return next;
        }
        return { ...current, [taskId]: items };
      });
    },
    [],
  );

  function resetChecklistForm() {
    setChecklistName("");
    setChecklistItemLabels([""]);
    setChecklistError(null);
    setShowChecklistForm(false);
  }

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
      memberSatisfiesMinRole(member, "board") || task.assignee_id === member.id
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

  async function handleSaveChecklist(
    taskId: number,
    draft: ChecklistStructureDraft,
  ) {
    try {
      const updated = await saveEventTaskChecklist(taskId, draft);
      setTasks((current) => {
        const next = replaceEventTaskInList(current, updated);
        syncFallbackTasks(next);
        return next;
      });
    } catch (error) {
      try {
        const refreshed = await fetchEventTasks(eventId);
        setTasks(refreshed.tasks);
        syncFallbackTasks(refreshed.tasks);
      } catch {
        // The checklist editor keeps the unsaved draft and shows the save error.
      }
      throw error;
    }
  }

  async function handleDeleteChecklist(task: EventTaskResponse) {
    const title = task.group_name ?? task.title;
    if (
      !window.confirm(
        `Delete checklist "${title}" and all of its items? This cannot be undone.`,
      )
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

  async function handleCreateChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = checklistName.trim();
    const labels = checklistItemLabels.map((label) => label.trim());
    if (!name) {
      setChecklistError("Category name is required.");
      return;
    }
    if (labels.length === 0 || labels.some((label) => label.length === 0)) {
      setChecklistError("Every checklist item needs a name.");
      return;
    }
    if (!eventStartsAt) {
      setChecklistError("This event needs a start time before a checklist can be added.");
      return;
    }

    setIsSavingChecklist(true);
    setChecklistError(null);
    try {
      await addPrepTaskToEvent(eventId, {
        group_name: name,
        due_date: categoryDueDateFromEventStart(eventStartsAt),
        checklist_items: labels,
      });
    } catch (error) {
      setChecklistError(getApiErrorMessage(error));
      setIsSavingChecklist(false);
      return;
    }

    try {
      const refreshed = await fetchEventTasks(eventId);
      setTasks(refreshed.tasks);
      syncFallbackTasks(refreshed.tasks);
      resetChecklistForm();
    } catch (error) {
      resetChecklistForm();
      setActionError(
        `Checklist saved, but the task list could not be refreshed: ${getApiErrorMessage(error)} Reload before adding it again.`,
      );
    } finally {
      setIsSavingChecklist(false);
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
  const progressTasks = tasks.map((task) => {
    const preview = checklistDrafts[task.id];
    if (!preview) {
      return task;
    }
    return {
      ...task,
      checklist_items: preview.map((item, index) => ({
        id: -(index + 1),
        label: "",
        is_completed: item.is_completed,
        sort_order: index,
      })),
    };
  });
  const progress = calcEventTasksProgress(progressTasks);
  const completionSummary = calcTaskCompletionSummary(tasks);
  const showSection = canFetchAll || tasks.length > 0;
  const allowCreateTasks = canManageSimple && canCreateTasks;
  const canEditChecklist = canFetchAll;
  const allowNewChecklist = canEditChecklist && canCreateTasks;

  if (!showSection) {
    return null;
  }

  return (
    <section aria-label="Event tasks" id="event-tasks-section">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Tasks</h2>
        <div className="flex items-center gap-3">
          {completionSummary.total > 0 ? (
            <p className="event-command-count">
              {completionSummary.completed}/{completionSummary.total} done
            </p>
          ) : null}
          {allowNewChecklist && !showChecklistForm ? (
            <button
              type="button"
              className="event-command-btn"
              onClick={() => {
                setChecklistError(null);
                setShowChecklistForm(true);
              }}
            >
              New checklist
            </button>
          ) : null}
          {allowCreateTasks && !showAddForm ? (
            <button
              type="button"
              className="event-command-btn"
              onClick={() => setShowAddForm(true)}
            >
              New task
            </button>
          ) : null}
        </div>
      </div>

      {canManageSimple && !canCreateTasks ? (
        <p className="mt-2 text-sm text-label">
          This event has ended. New tasks can&apos;t be added.
        </p>
      ) : null}

      {checklistTasks.length > 0 ? (
        <div className="mt-3">
          <PrepProgressBar progress={progress} label="Overall task progress" />
        </div>
      ) : null}

      {allowNewChecklist && showChecklistForm ? (
        <Card padding="none" className="mt-3 space-y-2 p-3">
          <form
            onSubmit={(event) => void handleCreateChecklist(event)}
            className="space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-label">New checklist</p>
              <button
                type="button"
                onClick={resetChecklistForm}
                className="text-xs font-medium text-label transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <div>
              <label
                htmlFor="new-checklist-name"
                className="block text-xs font-medium text-label"
              >
                Category name
              </label>
              <input
                id="new-checklist-name"
                value={checklistName}
                maxLength={MAX_CHECKLIST_LABEL_LENGTH}
                disabled={isSavingChecklist}
                onChange={(event) => setChecklistName(event.target.value)}
                className={`${inputFieldClassName} mt-1`}
              />
            </div>
            <ul className="space-y-2">
              {checklistItemLabels.map((label, index) => (
                <li
                  key={`new-checklist-item-${index}`}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <label className="sr-only" htmlFor={`new-checklist-item-${index}`}>
                    New checklist item {index + 1}
                  </label>
                  <input
                    id={`new-checklist-item-${index}`}
                    value={label}
                    maxLength={MAX_CHECKLIST_LABEL_LENGTH}
                    disabled={isSavingChecklist}
                    placeholder="Checklist item"
                    onChange={(event) => {
                      const value = event.target.value;
                      setChecklistItemLabels((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? value : entry,
                        ),
                      );
                    }}
                    className={`${inputFieldClassName} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-foreground hover:bg-surface-muted disabled:opacity-40"
                    aria-label={`Remove new checklist item ${index + 1}`}
                    disabled={isSavingChecklist || checklistItemLabels.length <= 1}
                    onClick={() =>
                      setChecklistItemLabels((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                  >
                    <AppIcon icon={Trash2} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground"
              disabled={
                isSavingChecklist || checklistItemLabels.length >= MAX_CHECKLIST_ITEMS
              }
              onClick={() => setChecklistItemLabels((current) => [...current, ""])}
            >
              <AppIcon icon={Plus} />
              Add item
            </button>
            {checklistError ? (
              <p className="ds-field-error" role="alert">
                {checklistError}
              </p>
            ) : null}
            <Button
              type="submit"
              size="sm"
              loading={isSavingChecklist}
              disabled={isSavingChecklist}
            >
              Save checklist
            </Button>
          </form>
        </Card>
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
              canEditStructure={canEditChecklist}
              canDeleteCategory={canManageSimple}
              assignableMembers={assignableMembers}
              togglingItemId={togglingItemId}
              assigningTaskId={assigningTaskId}
              onToggleItem={(taskId, itemId, isCompleted) => {
                void handleToggleChecklistItem(taskId, itemId, isCompleted);
              }}
              onAssign={(taskId, nextAssigneeId) => {
                void handleAssignChecklistTask(taskId, nextAssigneeId);
              }}
              onSaveStructure={handleSaveChecklist}
              onDeleteCategory={(checklist) => {
                void handleDeleteChecklist(checklist);
              }}
              onStructurePreview={handleStructurePreview}
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
