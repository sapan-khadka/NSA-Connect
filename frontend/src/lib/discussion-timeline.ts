import type {
  DiscussionMessage,
  DiscussionMessageAuthor,
} from "./discussion-api";

/** Telegram-style: break group if same author pauses longer than this. */
export const DISCUSSION_GROUP_GAP_MS = 10 * 60 * 1000;

export type DiscussionTimelineItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "unread"; key: string }
  | {
      kind: "group";
      key: string;
      author: DiscussionMessageAuthor;
      isOwn: boolean;
      messages: DiscussionMessage[];
    };

function discussionDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessage = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfMessage.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function authorId(author: DiscussionMessageAuthor): number {
  return Number(author.id);
}

export function buildDiscussionTimeline(
  messages: DiscussionMessage[],
  viewerUserId: number | null,
  options?: { firstUnreadMessageId?: number | null },
): DiscussionTimelineItem[] {
  const items: DiscussionTimelineItem[] = [];
  let lastDay: string | null = null;
  let openGroup: Extract<DiscussionTimelineItem, { kind: "group" }> | null =
    null;
  const firstUnreadId = options?.firstUnreadMessageId ?? null;
  let unreadInserted = false;

  function flushGroup() {
    if (openGroup) {
      items.push(openGroup);
      openGroup = null;
    }
  }

  for (const message of messages) {
    const day = discussionDayKey(message.created_at);
    const id = authorId(message.author);
    const createdMs = new Date(message.created_at).getTime();

    if (day !== lastDay) {
      flushGroup();
      items.push({
        kind: "day",
        key: day,
        label: formatDayLabel(message.created_at),
      });
      lastDay = day;
    }

    if (
      !unreadInserted &&
      firstUnreadId != null &&
      message.id === firstUnreadId
    ) {
      flushGroup();
      items.push({ kind: "unread", key: "unread" });
      unreadInserted = true;
    }

    const lastInGroup = openGroup?.messages[openGroup.messages.length - 1];
    const lastMs = lastInGroup
      ? new Date(lastInGroup.created_at).getTime()
      : 0;
    const withinGap =
      openGroup != null &&
      authorId(openGroup.author) === id &&
      createdMs - lastMs <= DISCUSSION_GROUP_GAP_MS;

    if (withinGap && openGroup) {
      openGroup.messages.push(message);
      continue;
    }

    flushGroup();
    openGroup = {
      kind: "group",
      key: `group-${message.id}`,
      author: message.author,
      isOwn: viewerUserId != null && id === Number(viewerUserId),
      messages: [message],
    };
  }

  flushGroup();
  return items;
}
