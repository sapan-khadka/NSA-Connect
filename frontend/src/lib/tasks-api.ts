import api from "./api";
import type { PrepTaskResponse } from "./events-api";

export async function updatePrepTaskChecklistItem(
  taskId: number,
  itemId: number,
  isCompleted: boolean,
): Promise<PrepTaskResponse> {
  const response = await api.patch<PrepTaskResponse>(
    `/v1/tasks/${taskId}/checklist-items/${itemId}`,
    { is_completed: isCompleted },
  );
  return response.data;
}

export async function updatePrepTaskAssignee(
  taskId: number,
  assigneeId: number | null,
): Promise<PrepTaskResponse> {
  const response = await api.patch<PrepTaskResponse>(`/v1/tasks/${taskId}`, {
    assignee_id: assigneeId,
  });
  return response.data;
}

export async function updatePrepTaskCompletion(
  taskId: number,
  isComplete: boolean,
): Promise<PrepTaskResponse> {
  const response = await api.patch<PrepTaskResponse>(`/v1/tasks/${taskId}`, {
    is_complete: isComplete,
  });
  return response.data;
}
