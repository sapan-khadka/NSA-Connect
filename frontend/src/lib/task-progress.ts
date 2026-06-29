import type { EventTaskResponse } from "./event-tasks-api";
import type { PrepTaskResponse } from "./events-api";

export type TaskProgress = {
  completed: number;
  total: number;
  percent: number;
};

type ChecklistLike = {
  checklist_items: Array<{ is_completed: boolean }>;
  is_complete: boolean;
  is_overdue: boolean;
};

export function calcChecklistItemsProgress(
  items: Array<{ is_completed: boolean }>,
): TaskProgress {
  if (items.length === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const completed = items.filter((item) => item.is_completed).length;
  return {
    completed,
    total: items.length,
    percent: Math.round((completed / items.length) * 100),
  };
}

export function calcChecklistTaskProgress(task: ChecklistLike): TaskProgress {
  return calcChecklistItemsProgress(task.checklist_items);
}

export function calcEventTasksProgress(tasks: EventTaskResponse[]): TaskProgress {
  const checklistTasks = tasks.filter((task) => task.task_kind === "checklist");
  const items = checklistTasks.flatMap((task) => task.checklist_items);
  return calcChecklistItemsProgress(items);
}

export function calcPrepTasksProgress(tasks: PrepTaskResponse[]): TaskProgress {
  const items = tasks.flatMap((task) => task.checklist_items);
  return calcChecklistItemsProgress(items);
}

export function isOverdueIncompleteChecklistTask(task: ChecklistLike): boolean {
  return task.is_overdue && !task.is_complete;
}

export function applyChecklistItemToggle(
  task: EventTaskResponse,
  itemId: number,
  isCompleted: boolean,
): EventTaskResponse {
  const checklist_items = task.checklist_items.map((item) =>
    item.id === itemId ? { ...item, is_completed: isCompleted } : item,
  );
  const is_complete =
    checklist_items.length > 0 &&
    checklist_items.every((item) => item.is_completed);

  let status = task.status;
  if (is_complete) {
    status = "done";
  } else if (checklist_items.some((item) => item.is_completed)) {
    status = "in_progress";
  } else {
    status = "todo";
  }

  return {
    ...task,
    checklist_items,
    is_complete,
    status,
  };
}

export function replaceEventTaskInList(
  tasks: EventTaskResponse[],
  updatedTask: EventTaskResponse,
): EventTaskResponse[] {
  return tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}
