import api from "./api";

export type DiscussionMessageAuthor = {
  id: number;
  full_name: string;
};

export type DiscussionReactionSummary = {
  count: number;
  reacted_by_me: boolean;
};

export type DiscussionMessage = {
  id: number;
  content: string;
  event_id: number | null;
  created_at: string;
  author: DiscussionMessageAuthor;
  reactions?: Record<string, DiscussionReactionSummary>;
};

export type DiscussionMessageListResponse = {
  messages: DiscussionMessage[];
  total: number;
};

export const DISCUSSION_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "😮",
] as const;

export type DiscussionReactionEmoji =
  (typeof DISCUSSION_REACTION_EMOJIS)[number];

export type DiscussionInboxRoom = {
  room_id: string;
  label: string;
  event_id: number | null;
  event_type?: string | null;
  href: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_message_author: string | null;
  unread_count: number;
  unread_display: string | null;
  pinned: boolean;
  pinned_at: string | null;
};

export type DiscussionInboxResponse = {
  rooms: DiscussionInboxRoom[];
};

export function discussionRoomIdFromScope(
  scope: { type: "board" } | { type: "event"; eventId: number },
): string {
  return scope.type === "board" ? "board" : `event:${scope.eventId}`;
}

export async function fetchDiscussionInbox(): Promise<DiscussionInboxResponse> {
  const response = await api.get<DiscussionInboxResponse>(
    "/v1/discussions/inbox",
  );
  return response.data;
}

export async function markDiscussionRoomRead(
  roomId: string,
): Promise<{ room_id: string; last_read_at: string }> {
  const response = await api.post<{ room_id: string; last_read_at: string }>(
    "/v1/discussions/read",
    { room_id: roomId },
  );
  return response.data;
}

export async function toggleDiscussionRoomPin(
  roomId: string,
): Promise<{ room_id: string; pinned: boolean }> {
  const response = await api.post<{ room_id: string; pinned: boolean }>(
    "/v1/discussions/pins/toggle",
    { room_id: roomId },
  );
  return response.data;
}

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
