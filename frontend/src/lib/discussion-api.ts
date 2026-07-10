import api from "./api";

export type DiscussionMessageAuthor = {
  id: number;
  full_name: string;
};

export type DiscussionMessage = {
  id: number;
  content: string;
  event_id: number | null;
  created_at: string;
  author: DiscussionMessageAuthor;
};

export type DiscussionMessageListResponse = {
  messages: DiscussionMessage[];
  total: number;
};

export async function fetchEventDiscussion(
  eventId: number,
  options?: { afterId?: number; limit?: number },
): Promise<DiscussionMessageListResponse> {
  const response = await api.get<DiscussionMessageListResponse>(
    `/v1/events/${eventId}/discussion`,
    {
      params: {
        after_id: options?.afterId,
        limit: options?.limit,
      },
    },
  );
  return response.data;
}

export async function postEventDiscussion(
  eventId: number,
  content: string,
): Promise<DiscussionMessage> {
  const response = await api.post<DiscussionMessage>(
    `/v1/events/${eventId}/discussion`,
    { content },
  );
  return response.data;
}

export async function fetchBoardDiscussion(options?: {
  afterId?: number;
  limit?: number;
}): Promise<DiscussionMessageListResponse> {
  const response = await api.get<DiscussionMessageListResponse>(
    "/v1/board/discussion",
    {
      params: {
        after_id: options?.afterId,
        limit: options?.limit,
      },
    },
  );
  return response.data;
}

export async function postBoardDiscussion(
  content: string,
): Promise<DiscussionMessage> {
  const response = await api.post<DiscussionMessage>("/v1/board/discussion", {
    content,
  });
  return response.data;
}
