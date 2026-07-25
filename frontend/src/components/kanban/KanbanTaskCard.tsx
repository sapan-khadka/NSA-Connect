/**
 * Compact Pipedrive-style kanban card: priority strip, title, event, due, status.
 */

import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { isToday } from "../../lib/calendar";
import { formatEventDateTime } from "../../lib/format-datetime";
import {
  isSimpleKanbanTask,
  toKanbanTaskId,
  type KanbanColumnId,
  type KanbanTask,
} from "../../lib/kanban-status";
import { calcChecklistTaskProgress } from "../../lib/task-progress";
import { AppIcon } from "../ui/AppIcon";

type KanbanTaskCardProps = {
  task: KanbanTask;
  columnId: KanbanColumnId;
  isDragging?: boolean;
  hideAssignee?: boolean;
  onOpenTask?: (taskId: number) => void;
};

function isTaskOpen(task: KanbanTask): boolean {
  if (isSimpleKanbanTask(task)) {
    return task.status !== "done";
  }
  return !task.is_complete && task.status !== "done";
}

function getDueDisplay(task: KanbanTask): {
  label: string;
  warning: boolean;
} | null {
  if (!task.due_date) {
    return null;
  }

  const open = isTaskOpen(task);
  if (open && task.is_overdue) {
    return { label: "Overdue", warning: true };
  }
  if (open && isToday(new Date(task.due_date))) {
    return { label: "Due today", warning: true };
  }

  return {
    label: `Due ${formatEventDateTime(task.due_date)}`,
    warning: false,
  };
}

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function KanbanTaskCard({
  task,
  columnId,
  isDragging = false,
  hideAssignee = false,
  onOpenTask,
}: KanbanTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isActivelyDragging,
  } = useDraggable({
    id: toKanbanTaskId(task.id),
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const title = isSimpleKanbanTask(task)
    ? task.title
    : (task.group_name ?? task.title);
  const due = getDueDisplay(task);
  const checklistProgress = isSimpleKanbanTask(task)
    ? null
    : calcChecklistTaskProgress(task);
  const open = isTaskOpen(task);
  const urgency =
    open && task.is_overdue ? "high" : due?.warning ? "medium" : "low";
  const statusIcon =
    columnId === "done"
      ? Check
      : open && task.is_overdue
        ? AlertTriangle
        : ArrowRight;
  const statusTone =
    columnId === "done"
      ? "done"
      : open && task.is_overdue
        ? "overdue"
        : columnId === "in_progress"
          ? "progress"
          : "open";

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-kanban-column={columnId}
      {...attributes}
      {...listeners}
      role={onOpenTask ? "button" : undefined}
      tabIndex={onOpenTask ? 0 : undefined}
      aria-label={onOpenTask ? `Open ${title}` : undefined}
      onClick={() => {
        if (onOpenTask && !isActivelyDragging) {
          onOpenTask(task.id);
        }
      }}
      onKeyDown={(event) => {
        if (!onOpenTask) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenTask(task.id);
        }
      }}
      className={[
        "pd-deal-card",
        `pd-deal-card--urgency-${urgency}`,
        "touch-none outline-none focus-visible:outline-none",
        onOpenTask ? "cursor-pointer" : "cursor-grab",
        "focus-visible:ring-2 focus-visible:ring-primary/20",
        "active:cursor-grabbing",
        isActivelyDragging || isDragging ? "z-50 opacity-90" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={["pd-deal-card-strip", `is-${urgency}`].join(" ")}
        aria-hidden="true"
      />
      <div className="pd-deal-card-body">
        <h3 className="pd-deal-card-title">{title}</h3>
        <p className="pd-deal-card-subtitle">{task.eventName}</p>
        <div className="pd-deal-card-footer">
          {!hideAssignee ? (
            <span className="pd-deal-card-avatar" aria-hidden="true">
              {initials(task.assignee_name)}
            </span>
          ) : (
            <span className="pd-deal-card-avatar is-muted" aria-hidden="true">
              ·
            </span>
          )}
          <span className="pd-deal-card-meta">
            {due?.label ?? "No due date"}
            {checklistProgress && checklistProgress.total > 0
              ? ` · ${checklistProgress.completed}/${checklistProgress.total}`
              : ""}
          </span>
          <span
            className={["pd-deal-card-status", `is-${statusTone}`].join(" ")}
            aria-hidden="true"
          >
            <AppIcon icon={statusIcon} size="xs" className="text-current" />
          </span>
        </div>
      </div>
    </article>
  );
}
