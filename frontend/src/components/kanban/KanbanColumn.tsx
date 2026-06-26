import { useDroppable } from "@dnd-kit/core";

import type { KanbanColumnId, KanbanTask } from "../../lib/kanban-status";
import { KanbanTaskCard } from "./KanbanTaskCard";

export type KanbanColumnConfig = {
  id: KanbanColumnId;
  title: string;
  subtitle: string;
  headerClass: string;
  surfaceClass: string;
  glowClass: string;
};

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "todo",
    title: "To do",
    subtitle: "Ready to start",
    headerClass: "from-slate-700 to-slate-900",
    surfaceClass: "from-slate-50/90 to-white/70",
    glowClass: "bg-slate-400/20",
  },
  {
    id: "in_progress",
    title: "In progress",
    subtitle: "Checklist underway",
    headerClass: "from-amber-500 to-orange-600",
    surfaceClass: "from-amber-50/90 to-white/70",
    glowClass: "bg-amber-400/25",
  },
  {
    id: "done",
    title: "Done",
    subtitle: "Fully complete",
    headerClass: "from-emerald-500 to-teal-600",
    surfaceClass: "from-emerald-50/90 to-white/70",
    glowClass: "bg-emerald-400/25",
  },
];

type KanbanColumnProps = {
  column: KanbanColumnConfig;
  tasks: KanbanTask[];
  activeTaskId: number | null;
};

export function KanbanColumn({ column, tasks, activeTaskId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <section
      className={[
        "flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-white/60 shadow-lg backdrop-blur-md transition-all duration-300",
        isOver ? "scale-[1.01] ring-2 ring-accent/50 shadow-2xl" : "",
      ].join(" ")}
    >
      <header
        className={[
          "relative overflow-hidden bg-gradient-to-r px-5 py-4 text-white",
          column.headerClass,
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl",
            column.glowClass,
          ].join(" ")}
        />
        <div className="relative flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{column.title}</h2>
            <p className="text-sm text-white/80">{column.subtitle}</p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur-sm">
            {tasks.length}
          </span>
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-1 flex-col gap-3 bg-gradient-to-b p-4 transition-colors duration-300",
          column.surfaceClass,
          isOver ? "bg-accent/5" : "",
        ].join(" ")}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300/80 bg-white/40 px-4 py-10 text-center">
            <p className="text-sm text-gray-500">
              {isOver ? "Drop task here" : "No tasks in this column"}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              isDragging={activeTaskId === task.id}
            />
          ))
        )}
      </div>
    </section>
  );
}
