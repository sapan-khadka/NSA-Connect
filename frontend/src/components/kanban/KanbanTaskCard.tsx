/**
 * Compact kanban card: title, due state, assignee avatar, checklist X/Y.
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
      className={[
        "group cursor-grab touch-none rounded-kanban p-4 outline-none transition-all duration-200",
        "focus:outline-none focus-visible:outline-none active:cursor-grabbing",
        isActivelyDragging || isDragging
          ? "z-50 scale-[1.02]"
          : "hover:-translate-y-0.5",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: theme.eventLabel }}
          >
            {task.eventName}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm leading-snug text-foreground">
            {title}
          </h3>
        </div>
        <AssigneeAvatar name={task.assignee_name} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {due ? (
          <span
            className={[
              "rounded-full px-2.5 py-1 font-medium",
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
            className="rounded-full bg-white px-2.5 py-1 font-medium"
            style={{ color: theme.pillText }}
            aria-label={`${checklistProgress.completed} of ${checklistProgress.total} checklist items complete`}
          >
            {checklistProgress.completed}/{checklistProgress.total}
          </span>
        ) : null}
      </div>

      {onOpenTask ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpenTask(task.id)}
          className="mt-3 w-full rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
          style={{ backgroundColor: theme.buttonBg }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = theme.buttonHoverBg;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = theme.buttonBg;
          }}
        >
          Open details
        </button>
      ) : null}
    </article>
  );
}
