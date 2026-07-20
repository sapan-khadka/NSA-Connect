/**
 * Compact kanban card: title, due state, optional assignee avatar, checklist X/Y.
 * Whole card opens details; drag uses PointerSensor distance threshold.
 */

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
import { getKanbanColumnTheme } from "../../lib/kanban-theme";
import { calcChecklistTaskProgress } from "../../lib/task-progress";
import { AssigneeAvatar } from "../EventTaskManager";

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

export function KanbanTaskCard({
  task,
  columnId,
  isDragging = false,
  hideAssignee = false,
  onOpenTask,
}: KanbanTaskCardProps) {
  const theme = getKanbanColumnTheme(columnId);
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
    background: theme.cardGradient,
    boxShadow: theme.cardShadow,
  };

  const title = isSimpleKanbanTask(task)
    ? task.title
    : (task.group_name ?? task.title);
  const due = getDueDisplay(task);
  const checklistProgress = isSimpleKanbanTask(task)
    ? null
    : calcChecklistTaskProgress(task);

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
        "group touch-none rounded-kanban p-3 outline-none transition-all duration-200",
        onOpenTask ? "cursor-pointer" : "cursor-grab",
        "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        "active:cursor-grabbing",
        isActivelyDragging || isDragging
          ? "z-50 scale-[1.02]"
          : "hover:-translate-y-0.5",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: theme.eventLabel }}
          >
            {task.eventName}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {title}
          </h3>
        </div>
        {!hideAssignee ? (
          <AssigneeAvatar name={task.assignee_name} />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {due ? (
          <span
            className={[
              "rounded-full px-2 py-0.5 font-medium",
              due.warning
                ? "bg-overdue-surface text-overdue"
                : "bg-white",
            ].join(" ")}
            style={due.warning ? undefined : { color: theme.pillText }}
          >
            {due.label}
          </span>
        ) : null}
        {checklistProgress && checklistProgress.total > 0 ? (
          <span
            className="rounded-full bg-white px-2 py-0.5 font-medium"
            style={{ color: theme.pillText }}
            aria-label={`${checklistProgress.completed} of ${checklistProgress.total} checklist items complete`}
          >
            {checklistProgress.completed}/{checklistProgress.total}
          </span>
        ) : null}
      </div>
    </article>
  );
}
