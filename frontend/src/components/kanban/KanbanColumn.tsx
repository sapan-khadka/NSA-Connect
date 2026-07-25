import { useDroppable } from "@dnd-kit/core";

import type { KanbanColumnId, KanbanTask } from "../../lib/kanban-status";
import { TASK_STATUS_LABELS } from "../../lib/member-workspace-responsibilities";
import type { EventTaskStatus } from "../../lib/event-tasks-api";
import { KanbanTaskCard } from "./KanbanTaskCard";

export type KanbanColumnConfig = {
  id: KanbanColumnId;
  title: string;
  subtitle: string;
};

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "todo",
    title: TASK_STATUS_LABELS.todo,
    subtitle: "Assigned to you",
  },
  {
    id: "in_progress",
    title: TASK_STATUS_LABELS.in_progress,
    subtitle: "Work underway",
  },
  {
    id: "done",
    title: TASK_STATUS_LABELS.done,
    subtitle: "Completed with notes or photos",
  },
];

const COLUMN_RING_CLASS: Record<EventTaskStatus, string> = {
  todo: "is-todo",
  in_progress: "is-progress",
  done: "is-done",
};

type KanbanColumnProps = {
  column: KanbanColumnConfig;
  tasks: KanbanTask[];
  activeTaskId: number | null;
  onOpenTask?: (taskId: number) => void;
  onAddTask?: (columnId: KanbanColumnId) => void;
  hideAssignee?: boolean;
};

export function KanbanColumn({
  column,
  tasks,
  activeTaskId,
  onOpenTask,
  onAddTask,
  hideAssignee = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  const statusLabel = TASK_STATUS_LABELS[column.id];
  const isEmpty = tasks.length === 0;

  return (
    <section
      data-kanban-column={column.id}
      className={[
        "pd-deal-column",
        isOver ? "is-drop-target" : "",
        isEmpty ? "min-h-[10rem]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="pd-deal-column-header">
        <div className="min-w-0">
          <h2 className="pd-deal-column-title">{statusLabel}</h2>
          <p className="pd-deal-column-subtitle">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <span
          className={["pd-deal-column-ring", COLUMN_RING_CLASS[column.id]].join(
            " ",
          )}
          aria-hidden="true"
        />
      </header>

      <div ref={setNodeRef} className="pd-deal-column-list flex-1">
        {isEmpty ? (
          <div className="pd-deal-empty">{isOver ? "Drop task here" : "Empty"}</div>
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isDragging={activeTaskId === task.id}
              hideAssignee={hideAssignee}
              onOpenTask={onOpenTask}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => onAddTask?.(column.id)}
          className="pd-deal-add"
          disabled={!onAddTask}
        >
          + Add task
        </button>
      </div>
    </section>
  );
}
