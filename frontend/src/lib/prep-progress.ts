import type { PrepTaskResponse } from "./events-api";

export type PrepProgress = {
  completed: number;
  total: number;
  percent: number;
};

export function calcPrepProgress(tasks: PrepTaskResponse[]): PrepProgress {
  const items = tasks.flatMap((task) => task.checklist_items);

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

export function calcTaskProgress(task: PrepTaskResponse): PrepProgress {
  return calcPrepProgress([task]);
}

export function applyChecklistToggle(
  task: PrepTaskResponse,
  itemId: number,
  isCompleted: boolean,
): PrepTaskResponse {
  const checklist_items = task.checklist_items.map((item) =>
    item.id === itemId ? { ...item, is_completed: isCompleted } : item,
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

export function replacePrepTaskInList(
  tasks: PrepTaskResponse[],
  updatedTask: PrepTaskResponse,
): PrepTaskResponse[] {
  return tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}
