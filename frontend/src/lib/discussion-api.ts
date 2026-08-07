import api from "./api";

export type DiscussionAttachmentKind = "image" | "video" | "file" | "audio";

export type DiscussionAttachment = {
  id: number;
  kind: DiscussionAttachmentKind;
  file_name: string;
  content_type: string;
  size_bytes: number;
  url: string;
  public_id?: string | null;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  created_at: string;
};

export type DiscussionAttachmentUpload = {
  url: string;
  public_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  kind: DiscussionAttachmentKind;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
};

export type DiscussionSharedFile = {
  id: number;
  kind: DiscussionAttachmentKind;
  file_name: string;
  content_type: string;
  size_bytes: number;
  url: string;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  created_at: string;
  message_id: number;
  author_id: number;
  author_name: string;
};

export type DiscussionSharedFileListResponse = {
  files: DiscussionSharedFile[];
  total: number;
};

export type DiscussionMessageAuthor = {
  id: number;
  full_name: string;
};

export type DiscussionReactionSummary = {
  count: number;
  reacted_by_me: boolean;
};

export type DiscussionReplyPreview = {
  id: number;
  author_name: string;
  content: string;
  is_deleted: boolean;
};

export type DiscussionMessage = {
  id: number;
  content: string;
  event_id: number | null;
  custom_room_id?: number | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  author: DiscussionMessageAuthor;
  reactions?: Record<string, DiscussionReactionSummary>;
  reply_to_message_id?: number | null;
  reply_to?: DiscussionReplyPreview | null;
  attachments?: DiscussionAttachment[];
};

export type DiscussionPinnedMessage = {
  message: DiscussionMessage;
  pinned_at: string;
  pinned_by_name: string;
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

export type DiscussionRoomKind = "group" | "dm";

export type DiscussionRoom = {
  id: number;
  name: string;
  description: string | null;
  kind?: DiscussionRoomKind;
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
  peer_member_id?: number | null;
  peer_full_name?: string | null;
  avatar_url?: string | null;
};

export type DiscussionRoomListResponse = {
  rooms: DiscussionRoom[];
  total: number;
};

export type DiscussionMessageListResponse = {
  messages: DiscussionMessage[];
  total: number;
  pinned?: DiscussionPinnedMessage | null;
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
  /** Unread message @mentions the current member (home attention queue). */
  mentions_you?: boolean;
  /** Best unread snippet for home (prefers mentions over low-value acks). */
  attention_preview?: string | null;
  attention_author?: string | null;
  pinned: boolean;
  pinned_at: string | null;
  muted?: boolean;
  archived_for_me?: boolean;
  peer_user_id?: number | null;
  peer_avatar_url?: string | null;
  peer_online?: boolean | null;
  avatar_url?: string | null;
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
  personal_archived_rooms?: DiscussionInboxRoom[];
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

export async function toggleDiscussionRoomMute(
  roomId: string,
): Promise<{ room_id: string; muted: boolean }> {
  const response = await api.post<{ room_id: string; muted: boolean }>(
    "/v1/discussions/mutes/toggle",
    { room_id: roomId },
  );
  return response.data;
}

export async function toggleDiscussionRoomUserArchive(
  roomId: string,
): Promise<{ room_id: string; archived_for_me: boolean }> {
  const response = await api.post<{
    room_id: string;
    archived_for_me: boolean;
  }>("/v1/discussions/user-archives/toggle", { room_id: roomId });
  return response.data;
}

export async function fetchDiscussionWsTicket(): Promise<{
  token: string;
  expires_at: string;
}> {
  const response = await api.post<{ token: string; expires_at: string }>(
    "/v1/discussions/ws-ticket",
  );
  return response.data;
}

export async function uploadDiscussionAttachment(
  file: File,
): Promise<DiscussionAttachmentUpload> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<DiscussionAttachmentUpload>(
    "/v1/discussions/attachments/upload",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function fetchDiscussionPresence(
  userIds: number[],
): Promise<Record<string, boolean>> {
  if (userIds.length === 0) {
    return {};
  }
  const response = await api.get<{ online: Record<string, boolean> }>(
    "/v1/discussions/presence",
    {
      params: { user_ids: userIds.join(",") },
    },
  );
  return response.data.online ?? {};
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

export async function uploadGroupRoomAvatar(
  roomId: number,
  file: File,
): Promise<DiscussionRoom> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/avatar`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function deleteGroupRoomAvatar(
  roomId: number,
): Promise<DiscussionRoom> {
  const response = await api.delete<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/avatar`,
  );
  return response.data;
}

/** Find or create a private 1:1 DM with another approved member. */
export async function ensureDirectMessage(
  memberId: number,
): Promise<DiscussionRoom> {
  const response = await api.post<DiscussionRoom>("/v1/discussions/dms", {
    member_id: memberId,
  });
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

export async function fetchDiscussionSharedFiles(
  roomId: string,
  options?: {
    kind?: DiscussionAttachmentKind;
    limit?: number;
    offset?: number;
  },
): Promise<DiscussionSharedFileListResponse> {
  const response = await api.get<DiscussionSharedFileListResponse>(
    "/v1/discussions/files",
    {
      params: {
        room_id: roomId,
        kind: options?.kind,
        limit: options?.limit,
        offset: options?.offset,
      },
    },
  );
  return response.data;
}

export async function addDiscussionRoomMembers(
  roomId: number,
  memberIds: number[],
): Promise<DiscussionRoom> {
  const response = await api.post<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/members`,
    { member_ids: memberIds },
  );
  return response.data;
}

export async function removeDiscussionRoomMember(
  roomId: number,
  memberId: number,
): Promise<DiscussionRoom> {
  const response = await api.delete<DiscussionRoom>(
    `/v1/discussions/rooms/${roomId}/members/${memberId}`,
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

export async function editDiscussionMessage(
  messageId: number,
  content: string,
): Promise<DiscussionMessage> {
  const response = await api.patch<DiscussionMessage>(
    `/v1/discussions/messages/${messageId}`,
    { content },
  );
  return response.data;
}

export async function deleteDiscussionMessage(
  messageId: number,
): Promise<DiscussionMessage> {
  const response = await api.delete<DiscussionMessage>(
    `/v1/discussions/messages/${messageId}`,
  );
  return response.data;
}
