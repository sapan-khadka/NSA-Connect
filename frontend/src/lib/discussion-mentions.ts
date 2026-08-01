import type { DiscussionMessage } from "./discussion-api";

export type MentionKind = "member" | "event" | "task" | "budget";

export type MentionQuery = {
  kind: MentionKind;
  /** Query text after the trigger character, up to cursor. */
  query: string;
  /** Absolute start index of the trigger in the draft. */
  start: number;
  /** Absolute end index (cursor). */
  end: number;
};

/** Detect an active @ / # / $ mention being typed at the cursor. */
export function detectMentionQuery(
  draft: string,
  cursor: number,
): MentionQuery | null {
  const before = draft.slice(0, cursor);
  const match = /(?:^|[\s([{])([@#$])([^\s@#$]*)$/.exec(before);
  if (!match) {
    return null;
  }
  const trigger = match[1]!;
  const query = match[2] ?? "";
  const start = before.length - trigger.length - query.length;
  const kind: MentionKind =
    trigger === "@" ? "member" : trigger === "#" ? "task" : "budget";
  // `#` doubles for events — treat as task/event search together as "task"
  // Event mentions also use `#` with a space-friendly query.
  return { kind: trigger === "#" ? "event" : kind, query, start, end: cursor };
}

export function applyMentionCompletion(
  draft: string,
  mention: MentionQuery,
  insertion: string,
): { next: string; caret: number } {
  const next = `${draft.slice(0, mention.start)}${insertion}${draft.slice(mention.end)}`;
  const caret = mention.start + insertion.length;
  return { next, caret };
}

export type RichPreviewKind = "member" | "event" | "task" | "budget";

export type RichPreviewToken = {
  kind: RichPreviewKind;
  raw: string;
  /** Parsed label without trigger. */
  label: string;
};

const MENTION_TOKEN =
  /(?:^|[\s])(@[A-Za-z][\w.-]*(?:\s+[A-Za-z][\w.-]*){0,2}|#[\w]+(?:\s+[\w][\w-]*){0,5}|\$[Bb]udget(?:\s+\w[\w\s-]{0,30})?)/g;

/** Extract rich-preview tokens from message content (best-effort). */
export function extractRichPreviewTokens(content: string): RichPreviewToken[] {
  const tokens: RichPreviewToken[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(MENTION_TOKEN)) {
    const raw = (match[1] ?? match[0] ?? "").trim();
    if (!raw || seen.has(raw.toLowerCase())) {
      continue;
    }
    seen.add(raw.toLowerCase());
    if (raw.startsWith("@")) {
      tokens.push({ kind: "member", raw, label: raw.slice(1).trim() });
    } else if (raw.startsWith("#")) {
      tokens.push({ kind: "event", raw, label: raw.slice(1).trim() });
    } else if (raw.toLowerCase().startsWith("$budget")) {
      tokens.push({
        kind: "budget",
        raw,
        label: raw.replace(/^\$[Bb]udget\s*/i, "").trim() || "Budget",
      });
    }
  }
  // Heuristic: bare event-like titles after common verbs aren't detected —
  // also treat `#task …` as task when prefixed with "task:"
  return tokens;
}

export function messagePermalink(
  pathname: string,
  messageId: number,
): string {
  if (typeof window === "undefined") {
    return `${pathname}?msg=${messageId}`;
  }
  return `${window.location.origin}${pathname}?msg=${messageId}`;
}

/** Build a forwardable payload (content + attribution). */
export function formatForwardedContent(message: DiscussionMessage): string {
  const author = message.author.full_name || "Member";
  const body = message.is_deleted
    ? "Original message deleted"
    : message.content.trim();
  return `Forwarded from ${author}:\n${body}`;
}
