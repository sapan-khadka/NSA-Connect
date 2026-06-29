import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { formatEventDateTime } from "../../lib/format-datetime";
import {
  getKanbanTaskProgressLabel,
  toKanbanTaskId,
  type KanbanTask,
} from "../../lib/kanban-status";
import { isOverdueIncompleteChecklistTask } from "../../lib/task-progress";
import {
  getKanbanProgressTone,
  getTaskProgressPercent,
  KanbanProgressRingWithLabel,
} from "./KanbanProgressRing";

type KanbanTaskCardProps = {
  task: KanbanTask;
  isDragging?: boolean;
};

export function KanbanTaskCard({ task, isDragging = false }: KanbanTaskCardProps) {
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
  const showOverdue = isOverdueIncompleteChecklistTask(task);
  const progressTone = getKanbanProgressTone(showOverdue, task.is_complete);

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        "group cursor-grab touch-none rounded-xl border bg-white/95 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 active:cursor-grabbing",
        showOverdue
          ? "border-red-200/80 ring-1 ring-red-100"
          : "border-white/80 ring-1 ring-gray-100",
        isActivelyDragging || isDragging
          ? "z-50 scale-[1.03] rotate-1 shadow-2xl ring-2 ring-accent/40"
          : "hover:-translate-y-0.5 hover:shadow-lg hover:ring-accent/20",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            {task.eventName}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-primary">
            {task.group_name ?? task.title}
          </h3>
        </div>
        <KanbanProgressRingWithLabel percent={percent} tone={progressTone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {task.due_date ? (
          <span className="rounded-full bg-primary/5 px-2.5 py-1 font-medium text-primary/80">
            Due {formatEventDateTime(task.due_date)}
          </span>
        ) : null}
        {showOverdue ? (
          <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
            Overdue
          </span>
        ) : null}
        {task.is_complete ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
            Complete
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {getKanbanTaskProgressLabel(task)}
      </p>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={[
            "h-full rounded-full transition-all duration-500",
            task.is_complete
              ? "bg-emerald-500"
              : showOverdue
                ? "bg-red-500"
                : "bg-accent",
          ].join(" ")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </article>
  );
}
