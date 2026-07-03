import { useDroppable } from "@dnd-kit/core";

import { getKanbanColumnTheme } from "../../lib/kanban-theme";
import type { KanbanColumnId, KanbanTask } from "../../lib/kanban-status";
import { KanbanTaskCard } from "./KanbanTaskCard";

export type KanbanColumnConfig = {
  id: KanbanColumnId;
  title: string;
  subtitle: string;
};

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "todo",
    title: "To do",
    subtitle: "Assigned to you",
  },
  {
    id: "in_progress",
    title: "In progress",
    subtitle: "Work underway",
  },
  {
    id: "done",
    title: "Done",
    subtitle: "Completed with notes or photos",
  },
];

type KanbanColumnProps = {
  column: KanbanColumnConfig;
  tasks: KanbanTask[];
  activeTaskId: number | null;
  onOpenTask?: (taskId: number) => void;
};

export function KanbanColumn({
  column,
  tasks,
  activeTaskId,
  onOpenTask,
}: KanbanColumnProps) {
  const theme = getKanbanColumnTheme(column.id);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <section
      data-kanban-column={column.id}
      className={[
        "flex flex-col overflow-hidden rounded-kanban border border-kanban-border bg-white transition-colors duration-200",
        isOver ? "ring-2 ring-accent/20" : "",
      ].join(" ")}
    >
      <header className="border-b border-kanban-border bg-white px-4 py-3">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white"
          style={{ backgroundColor: theme.headerBg }}
        >
          <span>{column.title}</span>
          <span
            aria-label={`${tasks.length} tasks`}
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-semibold text-white"
          >
            {tasks.length}
          </span>
        </div>
        <p className="mt-2 text-sm text-label">{column.subtitle}</p>
      </header>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-col gap-3 p-3 transition-colors duration-200",
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
              column.id === "todo" ? { backgroundColor: theme.emptyBg } : undefined
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
      </div>
    </section>
  );
}
