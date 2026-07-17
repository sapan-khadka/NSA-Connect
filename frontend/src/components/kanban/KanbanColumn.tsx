import { useDroppable } from "@dnd-kit/core";

import { getKanbanColumnTheme } from "../../lib/kanban-theme";
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

/** Status dots aligned with EventTaskManager STATUS_BADGE_STYLES tones. */
const COLUMN_STATUS_DOT_CLASS: Record<EventTaskStatus, string> = {
  todo: "bg-label",
  in_progress: "bg-accent",
  done: "bg-primary",
};

type KanbanColumnProps = {
  column: KanbanColumnConfig;
  tasks: KanbanTask[];
  activeTaskId: number | null;
  onOpenTask?: (taskId: number) => void;
  onAddTask?: (columnId: KanbanColumnId) => void;
};

export function KanbanColumn({
  column,
  tasks,
  activeTaskId,
  onOpenTask,
  onAddTask,
}: KanbanColumnProps) {
  const theme = getKanbanColumnTheme(column.id);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  const statusLabel = TASK_STATUS_LABELS[column.id];

  return (
    <section
      data-kanban-column={column.id}
      className={[
        "flex flex-col overflow-hidden rounded-kanban border border-kanban-border bg-white transition-colors duration-200",
        isOver ? "ring-2 ring-accent/20" : "",
      ].join(" ")}
    >
      <header className="border-b border-kanban-border bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${COLUMN_STATUS_DOT_CLASS[column.id]}`}
          />
          <h2 className="text-sm font-semibold text-foreground">
            {`${statusLabel} · ${tasks.length}`}
          </h2>
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-1 flex-col gap-3 p-3 transition-colors duration-200",
          isOver ? "bg-accent/[0.03]" : "bg-white",
        ].join(" ")}
      >
        {tasks.length === 0 ? (
          <div
            className={[
              "rounded-kanban px-4 py-6 text-center",
              column.id === "todo"
                ? "border border-dashed border-kanban-border"
                : "",
            ].join(" ")}
            style={
              column.id === "todo"
                ? { backgroundColor: theme.emptyBg }
                : undefined
            }
          >
            <p className="text-sm text-label">
              {isOver ? "Drop task here" : "No tasks in this column"}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isDragging={activeTaskId === task.id}
              onOpenTask={onOpenTask}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => onAddTask?.(column.id)}
          className="mt-auto rounded-kanban border border-dashed border-kanban-border px-3 py-2.5 text-left text-sm font-medium text-label transition-colors hover:border-accent/40 hover:bg-accent/[0.03] hover:text-foreground"
        >
          + Add task
        </button>
      </div>
    </section>
  );
}
