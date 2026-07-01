import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { formatEventDateTime } from "../../lib/format-datetime";
import {
  getKanbanTaskProgressLabel,
  isSimpleKanbanTask,
  toKanbanTaskId,
  type KanbanTask,
} from "../../lib/kanban-status";
import {
  getKanbanProgressTone,
  getTaskProgressPercent,
  KanbanProgressRingWithLabel,
} from "./KanbanProgressRing";

type KanbanTaskCardProps = {
  task: KanbanTask;
  isDragging?: boolean;
  onOpenTask?: (taskId: number) => void;
};

export function KanbanTaskCard({
  task,
  isDragging = false,
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

  const percent = getTaskProgressPercent(task);
  const showOverdue =
    task.is_overdue &&
    !task.is_complete &&
    (!isSimpleKanbanTask(task) || task.status !== "done");
  const progressTone = getKanbanProgressTone(showOverdue, task.is_complete);

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        "group cursor-grab touch-none ds-card p-4 transition-all duration-200 active:cursor-grabbing",
        isActivelyDragging || isDragging
          ? "z-50 scale-[1.02] ring-2 ring-accent/30"
          : "ds-card-interactive",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-accent">
            {task.eventName}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm leading-snug text-foreground">
            {isSimpleKanbanTask(task) ? task.title : (task.group_name ?? task.title)}
          </h3>
          {isSimpleKanbanTask(task) && task.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-label">
              {task.description}
            </p>
          ) : null}
        </div>
        <KanbanProgressRingWithLabel percent={percent} tone={progressTone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {task.due_date ? (
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-label">
            Due {formatEventDateTime(task.due_date)}
          </span>
        ) : null}
        {showOverdue ? (
          <span className="ds-tag-overdue">Overdue</span>
        ) : null}
        {task.is_complete ? (
          <span className="ds-tag">Complete</span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-label">
        {getKanbanTaskProgressLabel(task)}
      </p>

      {task.completion_note ? (
        <p className="mt-2 line-clamp-2 rounded-md bg-surface-muted px-2 py-1 text-xs text-label">
          Note: {task.completion_note}
        </p>
      ) : null}

      {onOpenTask ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpenTask(task.id)}
          className="mt-3 w-full rounded-md border border-kanban-border px-3 py-1.5 text-xs text-foreground transition hover:border-accent hover:bg-accent/5"
        >
          Open details
        </button>
      ) : null}

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={[
            "h-full rounded-full transition-all duration-500",
            task.is_complete
              ? "bg-mint"
              : showOverdue
                ? "bg-overdue"
                : "bg-accent",
          ].join(" ")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </article>
  );
}
