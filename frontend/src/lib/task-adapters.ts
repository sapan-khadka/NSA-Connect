import type { EventTaskResponse } from "./event-tasks-api";
import type { PrepTaskResponse } from "./events-api";

export function prepTaskToEventTask(
  prep: PrepTaskResponse,
  event: { id: number; name: string },
): EventTaskResponse {
  return {
    id: prep.id,
    event_id: event.id,
    event_name: event.name,
    task_kind: "checklist",
    title: prep.group_name,
    group_name: prep.group_name,
    description: "",
    assignee_id: prep.assignee_id,
    assignee_name: null,
    status: prep.is_complete
      ? "done"
      : prep.checklist_items.some((item) => item.is_completed)
        ? "in_progress"
        : "todo",
    due_date: prep.due_date,
    is_overdue: prep.is_overdue,
    is_complete: prep.is_complete,
    checklist_items: prep.checklist_items,
    completion_note: null,
    completion_photo_url: null,
    completed_at: prep.is_complete ? prep.due_date : null,
    created_by_id: null,
    created_at: prep.due_date,
  };
}

export function eventTaskToPrepTask(task: EventTaskResponse): PrepTaskResponse {
  return {
    id: task.id,
    group_name: task.group_name ?? task.title,
    due_date: task.due_date ?? task.created_at,
    assignee_id: task.assignee_id,
    is_overdue: task.is_overdue,
    is_complete: task.is_complete,
    checklist_items: task.checklist_items,
  };
}
