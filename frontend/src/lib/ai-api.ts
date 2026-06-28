import api from "./api";
import type { EventType } from "./event-types";

export type ChecklistCategory = {
  category: string;
  tasks: string[];
};

export type GenerateChecklistResponse = {
  categories: ChecklistCategory[];
};

export type GenerateChecklistRequest = {
  event_name: string;
  event_type: EventType;
  tasks?: string[];
};

export async function generateEventChecklist(
  data: GenerateChecklistRequest,
): Promise<GenerateChecklistResponse> {
  const response = await api.post<GenerateChecklistResponse>(
    "/v1/ai/generate-checklist",
    data,
  );
  return response.data;
}

export function countChecklistTasks(categories: ChecklistCategory[]): number {
  return categories.reduce((total, category) => total + category.tasks.length, 0);
}
