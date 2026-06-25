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
