import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import {
  getKanbanColumn,
  groupTasksByKanbanColumn,
  isKanbanColumnId,
  parseKanbanTaskId,
  type KanbanColumnId,
  type KanbanTask,
} from "../../lib/kanban-status";
import { KanbanColumn, KANBAN_COLUMNS } from "./KanbanColumn";
import { KanbanTaskCard } from "./KanbanTaskCard";

type BoardTaskKanbanProps = {
  tasks: KanbanTask[];
  onMoveTask: (taskId: number, targetColumn: KanbanColumnId) => void;
  movingTaskId?: number | null;
  onOpenTask?: (taskId: number) => void;
};

function resolveDropColumn(
  tasks: KanbanTask[],
  overId: string | number,
): KanbanColumnId | null {
  if (isKanbanColumnId(String(overId))) {
    return overId as KanbanColumnId;
  }

  const taskId = parseKanbanTaskId(overId);
  if (taskId === null) {
    return null;
  }

  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return null;
  }

  return getKanbanColumn(task);
}

export function BoardTaskKanban({
  tasks,
  onMoveTask,
  movingTaskId = null,
  onOpenTask,
}: BoardTaskKanbanProps) {
  const grouped = groupTasksByKanbanColumn(tasks);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const overlayTask =
    activeTaskId !== null
      ? tasks.find((task) => task.id === activeTaskId) ?? null
      : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(parseKanbanTaskId(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);

    const taskId = parseKanbanTaskId(event.active.id);
    if (taskId === null || !event.over) {
      return;
    }

    const targetColumn = resolveDropColumn(tasks, event.over.id);
    if (targetColumn === null) {
      return;
    }

    onMoveTask(taskId, targetColumn);
  }

  function handleDragCancel() {
    setActiveTaskId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid gap-5 xl:grid-cols-3">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={grouped[column.id]}
            activeTaskId={movingTaskId ?? activeTaskId}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {overlayTask ? (
          <div className="rotate-2 scale-105">
            <KanbanTaskCard task={overlayTask} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
