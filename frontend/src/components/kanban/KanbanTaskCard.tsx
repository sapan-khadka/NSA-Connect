import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { formatEventDateTime } from "../../lib/format-datetime";
import {
  getKanbanTaskProgressLabel,
  isSimpleKanbanTask,
  toKanbanTaskId,
  type KanbanColumnId,
  type KanbanTask,
} from "../../lib/kanban-status";
import { getKanbanColumnTheme } from "../../lib/kanban-theme";
import {
  getTaskProgressPercent,
  KanbanProgressRingWithLabel,
} from "./KanbanProgressRing";

type KanbanTaskCardProps = {
  task: KanbanTask;
  columnId: KanbanColumnId;
  isDragging?: boolean;
  onOpenTask?: (taskId: number) => void;
};

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

  const percent = getTaskProgressPercent(task);
  const showOverdue =
    task.is_overdue &&
    !task.is_complete &&
    (!isSimpleKanbanTask(task) || task.status !== "done");

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
        isActivelyDragging || isDragging ? "z-50 scale-[1.02]" : "hover:-translate-y-0.5",
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
            {isSimpleKanbanTask(task) ? task.title : (task.group_name ?? task.title)}
          </h3>
          {isSimpleKanbanTask(task) && task.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-label">
              {task.description}
            </p>
          ) : null}
        </div>
        <KanbanProgressRingWithLabel percent={percent} columnId={columnId} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {task.due_date ? (
          <span
            className="rounded-full bg-white px-2.5 py-1 font-medium"
            style={{ color: theme.pillText }}
          >
            Due {formatEventDateTime(task.due_date)}
          </span>
        ) : null}
        {showOverdue ? (
          <span className="ds-tag-overdue">Overdue</span>
        ) : null}
        {task.is_complete ? (
          <span
            className="rounded-full bg-white px-2.5 py-1 font-medium"
            style={{ color: theme.pillText }}
          >
            Complete
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-label">
        {getKanbanTaskProgressLabel(task)}
      </p>

      {task.completion_note ? (
        <p className="mt-2 line-clamp-2 rounded-md bg-white/70 px-2 py-1 text-xs text-label">
          Note: {task.completion_note}
        </p>
      ) : null}

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

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/60">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            backgroundColor: theme.progressColor,
          }}
        />
      </div>
    </article>
  );
}
