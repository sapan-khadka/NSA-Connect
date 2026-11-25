import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import type { MemberResponse } from "../lib/auth-api";
import {
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_LABEL_LENGTH,
} from "../lib/draft-checklist";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { getApiErrorMessage } from "../lib/api-error";
import {
  calcChecklistItemsProgress,
  calcChecklistTaskProgress,
  isOverdueIncompleteChecklistTask,
} from "../lib/task-progress";
import { PrepProgressBar } from "./PrepProgressBar";
import { PrepTaskAssigneeSelect } from "./PrepTaskAssigneeSelect";
import { AppIcon } from "./ui/AppIcon";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { inputFieldClassName } from "./ui/Input";

type ChecklistDraftItem = {
  key: string;
  id: number | null;
  label: string;
  isCompleted: boolean;
};

export type ChecklistStructureDraft = {
  title: string;
  base_title: string;
  base_items: Array<{ id: number; label: string; sort_order: number }>;
  items: Array<{ id: number | null; label: string }>;
};

type ChecklistTaskCardProps = {
  task: EventTaskResponse;
  canToggle: boolean;
  canAssign: boolean;
  canEditStructure?: boolean;
  canDeleteCategory?: boolean;
  assignableMembers: MemberResponse[];
  togglingItemId?: number | null;
  assigningTaskId?: number | null;
  onToggleItem: (taskId: number, itemId: number, isCompleted: boolean) => void;
  onAssign: (taskId: number, assigneeId: number | null) => void;
  onSaveStructure?: (
    taskId: number,
    draft: ChecklistStructureDraft,
  ) => Promise<void>;
  onDeleteCategory?: (task: EventTaskResponse) => void;
  onStructurePreview?: (
    taskId: number,
    items: Array<{ is_completed: boolean }> | null,
  ) => void;
};

const iconButtonClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40";

const textButtonClassName =
  "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-sm font-medium text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

function getAssigneeLabel(
  assigneeId: number | null,
  assignableMembers: MemberResponse[],
  assigneeName: string | null,
): string | null {
  if (assigneeName) {
    return assigneeName;
  }
  if (assigneeId === null) {
    return null;
  }
  return assignableMembers.find((member) => member.id === assigneeId)?.full_name ?? null;
}

function draftFromTask(task: EventTaskResponse): ChecklistDraftItem[] {
  return [...task.checklist_items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      key: `item-${item.id}`,
      id: item.id,
      label: item.label,
      isCompleted: item.is_completed,
    }));
}

export function ChecklistTaskCard({
  task,
  canToggle,
  canAssign,
  canEditStructure = false,
  canDeleteCategory = false,
  assignableMembers,
  togglingItemId = null,
  assigningTaskId = null,
  onToggleItem,
  onAssign,
  onSaveStructure,
  onDeleteCategory,
  onStructurePreview,
}: ChecklistTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.group_name ?? task.title);
  const [baseTitle, setBaseTitle] = useState(task.group_name ?? task.title);
  const [baseItems, setBaseItems] = useState<
    ChecklistStructureDraft["base_items"]
  >([]);
  const [draftItems, setDraftItems] = useState<ChecklistDraftItem[]>(() =>
    draftFromTask(task),
  );
  const [nextKey, setNextKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sortedItems = [...task.checklist_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const viewTitle = task.group_name ?? task.title;
  const taskProgress = editing
    ? calcChecklistItemsProgress(
        draftItems.map((item) => ({ is_completed: item.isCompleted })),
      )
    : calcChecklistTaskProgress(task);
  const assigneeLabel = getAssigneeLabel(
    task.assignee_id,
    assignableMembers,
    task.assignee_name,
  );
  const showOverdue = isOverdueIncompleteChecklistTask(task);

  useEffect(() => {
    if (!onStructurePreview) {
      return;
    }
    onStructurePreview(
      task.id,
      editing
        ? draftItems.map((item) => ({ is_completed: item.isCompleted }))
        : null,
    );
  }, [draftItems, editing, onStructurePreview, task.id]);

  function startEditing() {
    const snapshot = [...task.checklist_items].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    setTitle(viewTitle);
    setBaseTitle(viewTitle);
    setBaseItems(
      snapshot.map((item) => ({
        id: item.id,
        label: item.label,
        sort_order: item.sort_order,
      })),
    );
    setDraftItems(draftFromTask(task));
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setSaveError(null);
    setEditing(false);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setDraftItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  function removeItem(item: ChecklistDraftItem) {
    if (draftItems.length <= 1) {
      return;
    }
    if (item.id !== null && item.isCompleted) {
      const confirmed = window.confirm(
        `Delete the completed item "${item.label}"?`,
      );
      if (!confirmed) {
        return;
      }
    }
    setDraftItems((current) => current.filter((entry) => entry.key !== item.key));
  }

  function addItem() {
    if (draftItems.length >= MAX_CHECKLIST_ITEMS) {
      return;
    }
    const key = `new-${nextKey}`;
    setNextKey((current) => current + 1);
    setDraftItems((current) => [
      ...current,
      { key, id: null, label: "", isCompleted: false },
    ]);
  }

  async function saveChanges() {
    const trimmedTitle = title.trim();
    const items = draftItems.map((item) => ({
      id: item.id,
      label: item.label.trim(),
    }));
    if (!trimmedTitle) {
      setSaveError("Category name is required.");
      return;
    }
    if (items.length === 0 || items.some((item) => item.label.length === 0)) {
      setSaveError("Every checklist item needs a name.");
      return;
    }
    if (!onSaveStructure) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSaveStructure(task.id, {
        title: trimmedTitle,
        base_title: baseTitle,
        base_items: baseItems,
        items,
      });
      setEditing(false);
    } catch (error) {
      setSaveError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={[
        "rounded-md border p-3",
        showOverdue ? "border-primary/20 bg-surface-muted" : "border-gray-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {editing ? (
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`checklist-title-${task.id}`}
              className="block text-xs font-medium text-label"
            >
              Category name
            </label>
            <input
              id={`checklist-title-${task.id}`}
              value={title}
              maxLength={MAX_CHECKLIST_LABEL_LENGTH}
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
              className={`${inputFieldClassName} mt-1`}
            />
          </div>
        ) : (
          <h4 className="font-medium text-foreground">{viewTitle}</h4>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!editing && task.is_complete ? (
            <Badge variant="success" size="sm">
              Complete
            </Badge>
          ) : null}
          {!editing && showOverdue ? <Badge variant="danger">Overdue</Badge> : null}
          {!editing && canEditStructure ? (
            <button
              type="button"
              className={textButtonClassName}
              onClick={startEditing}
            >
              Edit checklist
            </button>
          ) : null}
          {!editing && canDeleteCategory ? (
            <button
              type="button"
              className={textButtonClassName}
              onClick={() => onDeleteCategory?.(task)}
            >
              Delete checklist
            </button>
          ) : null}
        </div>
      </div>

      {task.due_date ? (
        <p
          className={[
            "mt-1 text-xs",
            showOverdue ? "text-overdue" : "text-label",
          ].join(" ")}
        >
          Due {formatEventDateTime(task.due_date)}
          {!canAssign && assigneeLabel ? ` · ${assigneeLabel}` : null}
        </p>
      ) : null}

      {canAssign && !editing ? (
        <PrepTaskAssigneeSelect
          assigneeId={task.assignee_id}
          assignableMembers={assignableMembers}
          disabled={assigningTaskId === task.id}
          onAssign={(assigneeId) => onAssign(task.id, assigneeId)}
        />
      ) : null}

      {(editing ? draftItems.length > 0 : sortedItems.length > 0) ? (
        <div className="mt-3">
          <PrepProgressBar
            progress={taskProgress}
            label="Task progress"
            variant={showOverdue && !editing ? "danger" : "default"}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3">
          <ul className="space-y-2">
            {draftItems.map((item, index) => (
              <li key={item.key}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor={`checklist-item-${task.id}-${item.key}`}>
                    Checklist item {index + 1}
                  </label>
                  <input
                    id={`checklist-item-${task.id}-${item.key}`}
                    value={item.label}
                    maxLength={MAX_CHECKLIST_LABEL_LENGTH}
                    disabled={saving}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraftItems((current) =>
                        current.map((entry) =>
                          entry.key === item.key ? { ...entry, label: value } : entry,
                        ),
                      );
                    }}
                    placeholder="Checklist item"
                    className={`${inputFieldClassName} min-w-0 flex-1`}
                  />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className={iconButtonClassName}
                      aria-label={`Move item ${index + 1} up`}
                      disabled={saving || index === 0}
                      onClick={() => moveItem(index, -1)}
                    >
                      <AppIcon icon={ChevronUp} />
                    </button>
                    <button
                      type="button"
                      className={iconButtonClassName}
                      aria-label={`Move item ${index + 1} down`}
                      disabled={saving || index === draftItems.length - 1}
                      onClick={() => moveItem(index, 1)}
                    >
                      <AppIcon icon={ChevronDown} />
                    </button>
                    <button
                      type="button"
                      className={iconButtonClassName}
                      aria-label={`Remove item ${index + 1}`}
                      disabled={saving || draftItems.length <= 1}
                      onClick={() => removeItem(item)}
                    >
                      <AppIcon icon={Trash2} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${textButtonClassName} mt-2`}
            disabled={saving || draftItems.length >= MAX_CHECKLIST_ITEMS}
            onClick={addItem}
          >
            <AppIcon icon={Plus} />
            Add item
          </button>
          {saveError ? (
            <p className="mt-2 ds-field-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={saving}
              onClick={() => void saveChanges()}
            >
              Save changes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={cancelEditing}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : sortedItems.length === 0 ? (
        <p className="mt-3 text-sm text-label">No checklist items yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sortedItems.map((item) => {
            const isPending = togglingItemId === item.id;

            return (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <button
                  type="button"
                  aria-label={`${item.is_completed ? "Uncheck" : "Check"} ${item.label}`}
                  aria-pressed={item.is_completed}
                  disabled={!canToggle || isPending}
                  onClick={() =>
                    onToggleItem(task.id, item.id, !item.is_completed)
                  }
                  className={[
                    "mt-0.5 ds-icon-btn h-4 w-4 shrink-0 rounded border transition-colors",
                    item.is_completed
                      ? "border-foreground bg-foreground text-white"
                      : "border-gray-300 bg-white text-transparent",
                    canToggle && !isPending
                      ? "cursor-pointer hover:border-foreground/70"
                      : "cursor-default",
                    isPending ? "opacity-60" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.is_completed ? (
                    <AppIcon icon={Check} size="xs" className="text-white" />
                  ) : null}
                </button>
                <span
                  className={
                    item.is_completed
                      ? "text-label line-through"
                      : "text-foreground"
                  }
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
