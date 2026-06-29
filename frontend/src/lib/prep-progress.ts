import type { PrepTaskResponse } from "./events-api";
import {
  applyChecklistItemToggle,
  calcChecklistTaskProgress,
  calcPrepTasksProgress,
  isOverdueIncompleteChecklistTask,
} from "./task-progress";
import { eventTaskToPrepTask } from "./task-adapters";
import type { EventTaskResponse } from "./event-tasks-api";

export type PrepProgress = {
  completed: number;
  total: number;
  percent: number;
};

export const calcPrepProgress = calcPrepTasksProgress;
export const calcTaskProgress = calcChecklistTaskProgress;

export function isOverdueIncompleteTask(task: PrepTaskResponse): boolean {
  return isOverdueIncompleteChecklistTask(task);
}

export function applyChecklistToggle(
  task: PrepTaskResponse,
  itemId: number,
  isCompleted: boolean,
): PrepTaskResponse {
  const asEventTask: EventTaskResponse = {
    id: task.id,
    event_id: 0,
    event_name: "",
    task_kind: "checklist",
    title: task.group_name,
    group_name: task.group_name,
    description: "",
    assignee_id: task.assignee_id,
    assignee_name: null,
    status: task.is_complete
      ? "done"
      : task.checklist_items.some((item) => item.is_completed)
        ? "in_progress"
        : "todo",
    due_date: task.due_date,
    is_overdue: task.is_overdue,
    is_complete: task.is_complete,
    checklist_items: task.checklist_items,
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: null,
    created_at: task.due_date,
  };

  return eventTaskToPrepTask(
    applyChecklistItemToggle(asEventTask, itemId, isCompleted),
  );
}

export function replacePrepTaskInList(
  tasks: PrepTaskResponse[],
  updatedTask: PrepTaskResponse,
): PrepTaskResponse[] {
  return tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}
