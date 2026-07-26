import api from "./api";

import type { EventSuggestionMember } from "./event-suggestions-api";

export type IdeaComment = {
  id: number;
  suggestion_id: number;
  parent_id: number | null;
  content: string;
  author: EventSuggestionMember;
  created_at: string;
  deleted_at: string | null;
  is_deleted: boolean;
  can_delete: boolean;
  replies: IdeaComment[];
};

export type IdeaCommentListResponse = {
  comments: IdeaComment[];
  total: number;
};

export type IdeaCommentCreatePayload = {
  content: string;
  parent_id?: number | null;
};

export async function fetchIdeaComments(
  suggestionId: number,
): Promise<IdeaCommentListResponse> {
  const response = await api.get<IdeaCommentListResponse>(
    `/v1/event-suggestions/${suggestionId}/comments`,
  );
  return response.data;
}

export async function createIdeaComment(
  suggestionId: number,
  payload: IdeaCommentCreatePayload,
): Promise<IdeaComment> {
  const response = await api.post<IdeaComment>(
    `/v1/event-suggestions/${suggestionId}/comments`,
    payload,
  );
  return response.data;
}

export async function deleteIdeaComment(
  suggestionId: number,
  commentId: number,
): Promise<IdeaComment> {
  const response = await api.delete<IdeaComment>(
    `/v1/event-suggestions/${suggestionId}/comments/${commentId}`,
  );
  return response.data;
}
