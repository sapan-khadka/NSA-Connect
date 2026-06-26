import type { PrepTaskResponse } from "./events-api";
import { calcTaskProgress } from "./prep-progress";

export type KanbanColumnId = "todo" | "in_progress" | "done";

export const KANBAN_COLUMN_IDS: KanbanColumnId[] = [
  "todo",
  "in_progress",
  "done",
];

export type KanbanTask = PrepTaskResponse & {
  eventId: number;
  eventName: string;
  eventStartsAt: string;
};

export type KanbanColumnMoveAction =
  | { type: "bulk_complete"; value: boolean }
  | { type: "toggle_item"; itemId: number; value: boolean };

export function getKanbanColumn(task: PrepTaskResponse): KanbanColumnId {
  if (task.is_complete) {
    return "done";
  }

  const completedCount = task.checklist_items.filter(
    (item) => item.is_completed,
  ).length;

  if (completedCount > 0) {
    return "in_progress";
  }

  return "todo";
}

export function groupTasksByKanbanColumn(
  tasks: KanbanTask[],
): Record<KanbanColumnId, KanbanTask[]> {
  const grouped: Record<KanbanColumnId, KanbanTask[]> = {
    todo: [],
    in_progress: [],
    done: [],
  };

  for (const task of tasks) {
    grouped[getKanbanColumn(task)].push(task);
  }

  return grouped;
}

export function getKanbanMoveAction(
  task: PrepTaskResponse,
  targetColumn: KanbanColumnId,
): KanbanColumnMoveAction | null {
  const currentColumn = getKanbanColumn(task);
  if (currentColumn === targetColumn) {
    return null;
  }

  if (targetColumn === "done") {
    return { type: "bulk_complete", value: true };
  }

  if (targetColumn === "todo") {
    return { type: "bulk_complete", value: false };
  }

  if (targetColumn === "in_progress") {
    if (currentColumn === "todo") {
      const firstIncomplete = [...task.checklist_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .find((item) => !item.is_completed);

      if (firstIncomplete) {
        return {
          type: "toggle_item",
          itemId: firstIncomplete.id,
          value: true,
        };
      }

      return null;
    }

    if (currentColumn === "done") {
      const lastCompleted = [...task.checklist_items]
        .sort((a, b) => b.sort_order - a.sort_order)
        .find((item) => item.is_completed);

      if (lastCompleted) {
        return {
          type: "toggle_item",
          itemId: lastCompleted.id,
          value: false,
        };
      }

      return { type: "bulk_complete", value: false };
    }
  }

  return null;
}

export function applyKanbanMoveLocally(
  task: KanbanTask,
  action: KanbanColumnMoveAction,
): KanbanTask {
  if (action.type === "bulk_complete") {
    const checklist_items = task.checklist_items.map((item) => ({
      ...item,
      is_completed: action.value,
    }));

    return {
      ...task,
      checklist_items,
      is_complete: action.value && checklist_items.length > 0,
    };
  }

  const checklist_items = task.checklist_items.map((item) =>
    item.id === action.itemId
      ? { ...item, is_completed: action.value }
      : item,
  );
  const is_complete =
    checklist_items.length > 0 &&
    checklist_items.every((item) => item.is_completed);

  return {
    ...task,
    checklist_items,
    is_complete,
  };
}

export function getKanbanTaskProgressLabel(task: PrepTaskResponse): string {
  const { completed, total, percent } = calcTaskProgress(task);
  if (total === 0) {
    return "No checklist";
  }
  return `${completed}/${total} · ${percent}%`;
}

export function parseKanbanTaskId(id: string | number): number | null {
  if (typeof id === "number") {
    return id;
  }

  if (id.startsWith("task-")) {
    const parsed = Number.parseInt(id.slice(5), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toKanbanTaskId(taskId: number): string {
  return `task-${taskId}`;
}

export function isKanbanColumnId(value: string): value is KanbanColumnId {
  return KANBAN_COLUMN_IDS.includes(value as KanbanColumnId);
}
