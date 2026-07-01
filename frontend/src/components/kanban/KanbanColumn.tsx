import { useDroppable } from "@dnd-kit/core";

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
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <section
      className={[
        "flex flex-col overflow-hidden ds-card transition-colors duration-200",
        isOver ? "ring-2 ring-accent/30" : "",
      ].join(" ")}
    >
      <header className="flex items-center justify-between gap-3 border-b border-kanban-border bg-kanban-header px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base text-foreground">{column.title}</h2>
          <p className="text-sm text-label">{column.subtitle}</p>
        </div>
        <span
          aria-label={`${tasks.length} tasks`}
          className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-kanban-badge px-1.5 text-xs text-foreground"
        >
          {tasks.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-col gap-3 p-3 transition-colors duration-200",
          isOver ? "bg-accent/5" : "bg-white",
        ].join(" ")}
      >
        {tasks.length === 0 ? (
          <div className="rounded-kanban border border-dashed border-kanban-border px-4 py-6 text-center">
            <p className="text-sm text-label">
              {isOver ? "Drop task here" : "No tasks in this column"}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              isDragging={activeTaskId === task.id}
              onOpenTask={onOpenTask}
            />
          ))
        )}
      </div>
    </section>
  );
}
