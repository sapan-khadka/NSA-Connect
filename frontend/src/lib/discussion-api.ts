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
  custom_room_id?: number | null;
  created_at: string;
  author: DiscussionMessageAuthor;
  reactions?: Record<string, DiscussionReactionSummary>;
};

export type DiscussionRoomStatus =
  | "pending"
  | "live"
  | "rejected"
  | "archived";

export type DiscussionRoomMember = {
  member_id: number;
  full_name: string;
  role: "owner" | "member";
};

export type DiscussionRoom = {
  id: number;
  name: string;
  description: string | null;
  status: DiscussionRoomStatus;
  room_id: string;
  href: string;
  created_by_id: number;
  created_by_name: string;
  reviewed_by_id: number | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  members: DiscussionRoomMember[];
};

export type DiscussionRoomListResponse = {
  rooms: DiscussionRoom[];
  total: number;
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

export type DiscussionArchivedRoom = {
  room_id: string;
  label: string;
  href: string;
  kind: "board" | "event" | "room";
  archived_at: string | null;
};

export type DiscussionInboxResponse = {
  rooms: DiscussionInboxRoom[];
  archived_rooms?: DiscussionArchivedRoom[];
};

export function discussionRoomIdFromScope(
  scope:
    | { type: "board" }
    | { type: "event"; eventId: number }
    | { type: "room"; roomId: number },
): string {
  if (scope.type === "board") {
    return "board";
  }
  if (scope.type === "event") {
    return `event:${scope.eventId}`;
  }
  return `room:${scope.roomId}`;
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

export async function createDiscussionRoom(payload: {
  name: string;
  description?: string;
  member_ids?: number[];
}): Promise<DiscussionRoom> {
  const response = await api.post<DiscussionRoom>("/v1/discussions/rooms", payload);
  return response.data;
}

export async function fetchDiscussionRoom(
  roomId: number,
): Promise<DiscussionRoom> {
  const response = await api.get<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}`,
  );
  return response.data;
}

export async function fetchPendingDiscussionRooms(): Promise<DiscussionRoomListResponse> {
  const response = await api.get<DiscussionRoomListResponse>(
    "/v1/discussions/rooms/pending",
  );
  return response.data;
}

export async function fetchMyDiscussionRooms(): Promise<DiscussionRoomListResponse> {
  const response = await api.get<DiscussionRoomListResponse>(
    "/v1/discussions/rooms/mine",
  );
  return response.data;
}

export async function approveDiscussionRoom(
  roomId: number,
): Promise<DiscussionRoom> {
  const response = await api.post<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/approve`,
  );
  return response.data;
}

export async function rejectDiscussionRoom(
  roomId: number,
  reviewNote?: string,
): Promise<DiscussionRoom> {
  const response = await api.post<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/reject`,
    { review_note: reviewNote ?? null },
  );
  return response.data;
}

export async function archiveDiscussionRoom(
  roomId: number,
): Promise<DiscussionRoom> {
  const response = await api.post<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/archive`,
  );
  return response.data;
}

export type DiscussionArchiveResponse = {
  room_id: string;
  archived: boolean;
};

/** Archive board, event, or custom room by string room_id (`board`, `event:1`, `room:2`). */
export async function archiveDiscussionInboxRoom(
  roomId: string,
): Promise<DiscussionArchiveResponse> {
  const response = await api.post<DiscussionArchiveResponse>(
    "/v1/discussions/archive",
    { room_id: roomId },
  );
  return response.data;
}

export async function unarchiveDiscussionInboxRoom(
  roomId: string,
): Promise<DiscussionArchiveResponse> {
  const response = await api.post<DiscussionArchiveResponse>(
    "/v1/discussions/unarchive",
    { room_id: roomId },
  );
  return response.data;
}

export async function fetchCustomRoomDiscussion(
  roomId: number,
  options?: { afterId?: number; limit?: number },
): Promise<DiscussionMessageListResponse> {
  const response = await api.get<DiscussionMessageListResponse>(
    `/v1/discussions/rooms/${roomId}/messages`,
    {
      params: {
        after_id: options?.afterId,
        limit: options?.limit,
      },
    },
  );
  return response.data;
}

export async function postCustomRoomDiscussion(
  roomId: number,
  content: string,
): Promise<DiscussionMessage> {
  const response = await api.post<DiscussionMessage>(
    `/v1/discussions/rooms/${roomId}/messages`,
    { content },
  );
  return response.data;
}
