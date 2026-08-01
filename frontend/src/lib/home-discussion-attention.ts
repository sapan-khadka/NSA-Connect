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

function sortByRecency(a: DiscussionInboxRoom, b: DiscussionInboxRoom): number {
  const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
  const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
  return bTime - aTime;
}

/**
 * Compact Linear-style attention feed for the home Discussions card.
 * Mentions → unread → active → recent filler so the card stays dense.
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

  const priority: DiscussionAttentionItem[] = [];

  for (const room of rooms) {
    const mentioned = roomMentionsYou(room, viewerName);
    if (mentioned && room.unread_count > 0) {
      priority.push(buildItem(room, "mentioned"));
      continue;
    }
    if (room.muted) {
      continue;
    }
    if (room.unread_count > 0) {
      priority.push(buildItem(room, "unread"));
      continue;
    }
    if (isActiveNow(room, nowMs)) {
      priority.push(buildItem(room, "active"));
    }
  }

  priority.sort((a, b) => {
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
    return sortByRecency(a.room, b.room);
  });

  const items = priority.slice(0, Math.max(0, cap));
  if (items.length >= cap) {
    return items;
  }

  const used = new Set(items.map((item) => item.room.room_id));
  const recent = [...rooms]
    .filter((room) => !used.has(room.room_id) && !room.muted)
    .sort(sortByRecency);

  for (const room of recent) {
    if (items.length >= cap) {
      break;
    }
    items.push(buildItem(room, "recent"));
  }

  return items;
}
