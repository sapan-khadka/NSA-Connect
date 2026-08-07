import type { DiscussionInboxRoom } from "./discussion-api";

export type DiscussionAttentionKind =
  | "mentioned"
  | "unread"
  | "active"
  | "recent";

export type DiscussionRoomVisualKind = "board" | "channel" | "dm";

export type DiscussionAttentionItem = {
  room: DiscussionInboxRoom;
  kind: DiscussionAttentionKind;
  /** Channel / DM / board — drives the row icon. */
  roomKind: DiscussionRoomVisualKind;
  /** One-line context under the room name. */
  detail: string;
  /** Right-rail badge: "3 unread", "LIVE", or null. */
  badge: string | null;
};

export function roomVisualKind(
  room: DiscussionInboxRoom,
): DiscussionRoomVisualKind {
  if (room.room_id === "board") {
    return "board";
  }
  if (room.event_type === "dm") {
    return "dm";
  }
  return "channel";
}

const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

const KIND_RANK: Record<DiscussionAttentionKind, number> = {
  mentioned: 0,
  unread: 1,
  active: 2,
  recent: 3,
};

const LOW_VALUE_ACK =
  /^(ok|okay|k|kk|yes|yep|yeah|y|no|nah|n|thanks|thank you|ty|thx|np|sure|cool|nice|lol|lmao|haha|hehe|same|true|false|done|noted|👍|🙏|❤️|❤|🔥|😂|😊|👌|💯|✅|👏|🙌|✨)[.!]*$/i;

export function isLowValuePreview(text: string | null | undefined): boolean {
  const value = text?.trim() ?? "";
  if (!value) {
    return true;
  }
  if (value.length <= 2) {
    return true;
  }
  if (LOW_VALUE_ACK.test(value)) {
    return true;
  }
  if (!/[\p{L}\p{N}]/u.test(value)) {
    return true;
  }
  return false;
}

function previewMentionsViewer(
  preview: string | null | undefined,
  viewerName: string | null | undefined,
): boolean {
  if (!preview || !viewerName?.trim()) {
    return false;
  }
  const text = preview.toLowerCase();
  const full = viewerName.trim().toLowerCase();
  const first = full.split(/\s+/)[0] ?? full;
  const needles = [`@${full}`];
  if (first && first !== full) {
    needles.push(`@${first}`);
  }
  return needles.some((needle) => {
    let start = 0;
    while (start <= text.length) {
      const idx = text.indexOf(needle, start);
      if (idx < 0) {
        return false;
      }
      const end = idx + needle.length;
      const next = text[end];
      if (!next || !/[\w.]/.test(next)) {
        return true;
      }
      start = idx + 1;
    }
    return false;
  });
}

export function roomMentionsYou(
  room: DiscussionInboxRoom,
  viewerName?: string | null,
): boolean {
  if (room.mentions_you) {
    return true;
  }
  if (room.unread_count <= 0) {
    return false;
  }
  return (
    previewMentionsViewer(room.attention_preview, viewerName) ||
    previewMentionsViewer(room.last_message_preview, viewerName)
  );
}

function isActiveNow(room: DiscussionInboxRoom, nowMs: number): boolean {
  if (!room.last_message_at) {
    return false;
  }
  const at = new Date(room.last_message_at).getTime();
  if (!Number.isFinite(at)) {
    return false;
  }
  return nowMs - at >= 0 && nowMs - at <= ACTIVE_WINDOW_MS;
}

function resolveSnippet(room: DiscussionInboxRoom): {
  author: string | null;
  text: string | null;
} {
  const attentionText = room.attention_preview?.trim() || null;
  const attentionAuthor = room.attention_author?.trim() || null;
  if (attentionText && !isLowValuePreview(attentionText)) {
    return { author: attentionAuthor, text: attentionText };
  }
  const lastText = room.last_message_preview?.trim() || null;
  const lastAuthor = room.last_message_author?.trim() || null;
  if (lastText && !isLowValuePreview(lastText)) {
    return { author: lastAuthor, text: lastText };
  }
  return { author: null, text: null };
}

function formatDetail(
  snippet: { author: string | null; text: string | null },
  fallback: string,
): string {
  if (!snippet.text) {
    return fallback;
  }
  if (snippet.author) {
    return `${snippet.author}: ${snippet.text}`;
  }
  return snippet.text;
}

/** Compact numeric unread badge — "3", not "3 unread". */
function unreadBadge(room: DiscussionInboxRoom): string | null {
  if (room.unread_count <= 0) {
    return null;
  }
  return room.unread_display ?? String(room.unread_count);
}

function classifyKind(
  room: DiscussionInboxRoom,
  nowMs: number,
  viewerName: string | null,
): DiscussionAttentionKind {
  if (roomMentionsYou(room, viewerName) && room.unread_count > 0) {
    return "mentioned";
  }
  if (room.unread_count > 0) {
    return "unread";
  }
  if (isActiveNow(room, nowMs)) {
    return "active";
  }
  return "recent";
}

function buildItem(
  room: DiscussionInboxRoom,
  kind: DiscussionAttentionKind,
): DiscussionAttentionItem {
  const snippet = resolveSnippet(room);
  const roomKind = roomVisualKind(room);

  if (kind === "mentioned") {
    const who = room.attention_author?.trim() || snippet.author;
    return {
      room,
      kind,
      roomKind,
      detail: snippet.text
        ? formatDetail(
            { author: who, text: snippet.text },
            "@ You were mentioned",
          )
        : who
          ? `${who} mentioned you`
          : "@ You were mentioned",
      badge: unreadBadge(room),
    };
  }

  if (kind === "unread") {
    const count = room.unread_display ?? String(room.unread_count);
    return {
      room,
      kind,
      roomKind,
      detail: formatDetail(snippet, `${count} unread`),
      badge: unreadBadge(room),
    };
  }

  if (kind === "active") {
    return {
      room,
      kind,
      roomKind,
      detail: formatDetail(snippet, "Recent activity"),
      // No LIVE pill — unread badge only when actionable.
      badge: unreadBadge(room),
    };
  }

  return {
    room,
    kind,
    roomKind,
    detail: formatDetail(snippet, "No recent messages"),
    badge: unreadBadge(room),
  };
}

function messageTimeMs(room: DiscussionInboxRoom): number {
  if (!room.last_message_at) {
    return 0;
  }
  const at = new Date(room.last_message_at).getTime();
  return Number.isFinite(at) ? at : 0;
}

function pinnedTimeMs(room: DiscussionInboxRoom): number {
  if (!room.pinned_at) {
    return 0;
  }
  const at = new Date(room.pinned_at).getTime();
  return Number.isFinite(at) ? at : 0;
}

/**
 * Match Discussions inbox ordering: pinned block first (Board always first),
 * then attention rank among peers, then recency.
 */
export function compareAttentionItems(
  a: DiscussionAttentionItem,
  b: DiscussionAttentionItem,
): number {
  const pinA = a.room.pinned ? 0 : 1;
  const pinB = b.room.pinned ? 0 : 1;
  if (pinA !== pinB) {
    return pinA - pinB;
  }

  if (a.room.pinned && b.room.pinned) {
    if (a.room.room_id === "board" && b.room.room_id !== "board") {
      return -1;
    }
    if (b.room.room_id === "board" && a.room.room_id !== "board") {
      return 1;
    }
    const byPinnedAt = pinnedTimeMs(b.room) - pinnedTimeMs(a.room);
    if (byPinnedAt !== 0) {
      return byPinnedAt;
    }
  }

  const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (byKind !== 0) {
    return byKind;
  }

  if (a.kind === "mentioned" || a.kind === "unread") {
    const byUnread = b.room.unread_count - a.room.unread_count;
    if (byUnread !== 0) {
      return byUnread;
    }
  }

  return messageTimeMs(b.room) - messageTimeMs(a.room);
}

/**
 * Compact attention feed for Home Inbox + App Inbox rail.
 * Pins (incl. always-pinned Board Discussion) stay above unpinned rooms,
 * same as /discussions. Within each block: mentions → unread → active → recent.
 */
export function buildDiscussionAttentionItems(
  rooms: DiscussionInboxRoom[],
  options?: {
    cap?: number;
    now?: number | Date;
    viewerName?: string | null;
  },
): DiscussionAttentionItem[] {
  const cap = options?.cap ?? 5;
  const nowMs =
    options?.now instanceof Date
      ? options.now.getTime()
      : (options?.now ?? Date.now());
  const viewerName = options?.viewerName ?? null;

  const items: DiscussionAttentionItem[] = [];

  for (const room of rooms) {
    const mentioned = roomMentionsYou(room, viewerName);
    // Muted rooms stay out of the feed unless they have an unread mention.
    if (room.muted && !(mentioned && room.unread_count > 0)) {
      continue;
    }

    const kind = classifyKind(room, nowMs, viewerName);
    // Keep pinned rooms in the feed even when quiet so Board Discussion
    // (always pinned) and user pins stay visible and ordered at the top.
    if (
      kind === "recent" &&
      !room.pinned &&
      room.unread_count <= 0 &&
      !isActiveNow(room, nowMs)
    ) {
      // Defer quiet unpinned rooms to the recency fill pass below.
      continue;
    }

    items.push(buildItem(room, kind));
  }

  items.sort(compareAttentionItems);

  if (items.length >= cap) {
    return items.slice(0, Math.max(0, cap));
  }

  const used = new Set(items.map((item) => item.room.room_id));
  const recent = rooms
    .filter((room) => {
      if (used.has(room.room_id) || room.muted) {
        return false;
      }
      return true;
    })
    .map((room) => buildItem(room, "recent"))
    .sort(compareAttentionItems);

  for (const item of recent) {
    if (items.length >= cap) {
      break;
    }
    items.push(item);
  }

  return items;
}
