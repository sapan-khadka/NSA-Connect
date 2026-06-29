import api from "./api";
import type { MemberPosition } from "./roles";

export type EventTaskKind = "simple" | "checklist";

export type EventTaskStatus = "todo" | "in_progress" | "done";

export type EventTaskChecklistItemResponse = {
  id: number;
  label: string;
  is_completed: boolean;
  sort_order: number;
};

export type EventTaskResponse = {
  id: number;
  event_id: number;
  event_name: string;
  task_kind: EventTaskKind;
  title: string;
  group_name: string | null;
  description: string;
  assignee_id: number | null;
  assignee_name: string | null;
  status: EventTaskStatus;
  due_date: string | null;
  is_overdue: boolean;
  is_complete: boolean;
  checklist_items: EventTaskChecklistItemResponse[];
  completion_note: string | null;
  completion_photo_url: string | null;
  completed_at: string | null;
  created_by_id: number | null;
  created_at: string;
};

export type EventTaskListResponse = {
  tasks: EventTaskResponse[];
  total: number;
};

export type CreateEventTaskRequest = {
  title: string;
  description?: string;
  assignee_id?: number | null;
  due_date?: string | null;
};

export type UpdateEventTaskRequest = {
  title?: string;
  description?: string;
  assignee_id?: number | null;
  due_date?: string | null;
  status?: EventTaskStatus;
  is_complete?: boolean;
  completion_note?: string | null;
  completion_photo_url?: string | null;
};

export type TaskOverviewMember = {
  member_id: number;
  full_name: string;
  role: string;
  position: MemberPosition;
  total: number;
  completed: number;
  in_progress: number;
  todo: number;
  completion_percent: number;
  tasks: EventTaskResponse[];
};

export type TaskOverviewResponse = {
  members: TaskOverviewMember[];
  total_tasks: number;
  completed_tasks: number;
};

export type TaskPhotoUploadResponse = {
  photo_url: string;
};

export async function createEventTask(
  eventId: number,
  data: CreateEventTaskRequest,
): Promise<EventTaskResponse> {
  const response = await api.post<EventTaskResponse>(
    `/v1/events/${eventId}/event-tasks`,
    data,
  );
  return response.data;
}

export async function fetchEventTasks(
  eventId: number,
): Promise<EventTaskListResponse> {
  const response = await api.get<EventTaskListResponse>(
    `/v1/events/${eventId}/event-tasks`,
  );
  return response.data;
}

export async function fetchMyEventTasks(): Promise<EventTaskListResponse> {
  const response = await api.get<EventTaskListResponse>("/v1/event-tasks/mine");
  return response.data;
}

export async function fetchTaskOverview(): Promise<TaskOverviewResponse> {
  const response = await api.get<TaskOverviewResponse>(
    "/v1/event-tasks/overview",
  );
  return response.data;
}

export async function updateEventTask(
  taskId: number,
  data: UpdateEventTaskRequest,
): Promise<EventTaskResponse> {
  const response = await api.patch<EventTaskResponse>(
    `/v1/event-tasks/${taskId}`,
    data,
  );
  return response.data;
}

export async function updateEventTaskChecklistItem(
  taskId: number,
  itemId: number,
  isCompleted: boolean,
): Promise<EventTaskResponse> {
  const response = await api.patch<EventTaskResponse>(
    `/v1/event-tasks/${taskId}/checklist-items/${itemId}`,
    { is_completed: isCompleted },
  );
  return response.data;
}

export async function deleteEventTask(taskId: number): Promise<void> {
  await api.delete(`/v1/event-tasks/${taskId}`);
}

export async function uploadTaskPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<TaskPhotoUploadResponse>(
    "/v1/event-tasks/uploads",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.photo_url;
}
