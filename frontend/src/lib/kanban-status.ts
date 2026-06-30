import type { EventTaskResponse, EventTaskStatus } from "./event-tasks-api";
import { calcChecklistTaskProgress } from "./task-progress";

export type KanbanColumnId = "todo" | "in_progress" | "done";

export const KANBAN_COLUMN_IDS: KanbanColumnId[] = [
  "todo",
  "in_progress",
  "done",
];

export type KanbanTask = EventTaskResponse & {
  eventId: number;
  eventName: string;
  eventStartsAt: string;
};

export type KanbanColumnMoveAction =
  | { type: "bulk_complete"; value: boolean }
  | { type: "toggle_item"; itemId: number; value: boolean }
  | { type: "set_status"; status: EventTaskStatus };

const STATUS_TO_COLUMN: Record<EventTaskStatus, KanbanColumnId> = {
  todo: "todo",
  in_progress: "in_progress",
  done: "done",
};

const COLUMN_TO_STATUS: Record<KanbanColumnId, EventTaskStatus> = {
  todo: "todo",
  in_progress: "in_progress",
  done: "done",
};

export function isSimpleKanbanTask(task: EventTaskResponse): boolean {
  return task.task_kind === "simple";
}

export function getKanbanColumn(task: EventTaskResponse): KanbanColumnId {
  if (isSimpleKanbanTask(task)) {
    return STATUS_TO_COLUMN[task.status] ?? "todo";
  }

  if (task.is_complete || task.status === "done") {
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
  task: EventTaskResponse,
  targetColumn: KanbanColumnId,
): KanbanColumnMoveAction | null {
  const currentColumn = getKanbanColumn(task);
  if (currentColumn === targetColumn) {
    return null;
  }

  if (isSimpleKanbanTask(task)) {
    const nextStatus = COLUMN_TO_STATUS[targetColumn];
    if (task.status === nextStatus) {
      return null;
    }
    return { type: "set_status", status: nextStatus };
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
  if (action.type === "set_status") {
    return {
      ...task,
      status: action.status,
      is_complete: action.status === "done",
    };
  }

  if (action.type === "bulk_complete") {
    const checklist_items = task.checklist_items.map((item) => ({
      ...item,
      is_completed: action.value,
    }));

    return {
      ...task,
      checklist_items,
      is_complete: action.value && checklist_items.length > 0,
      status: action.value ? "done" : "todo",
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
    status: is_complete
      ? "done"
      : checklist_items.some((item) => item.is_completed)
        ? "in_progress"
        : "todo",
  };
}

export function getKanbanTaskProgressLabel(task: EventTaskResponse): string {
  if (isSimpleKanbanTask(task)) {
    if (task.status === "done") {
      return "Completed";
    }
    if (task.status === "in_progress") {
      return "In progress";
    }
    return "Assigned to you";
  }

  const { completed, total, percent } = calcChecklistTaskProgress(task);
  if (total === 0) {
    return "No checklist";
  }
  return `${completed}/${total} · ${percent}%`;
}

export function toKanbanTask(task: EventTaskResponse): KanbanTask {
  return {
    ...task,
    eventId: task.event_id,
    eventName: task.event_name,
    eventStartsAt: task.due_date ?? task.created_at,
  };
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
