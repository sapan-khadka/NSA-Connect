import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ArrowLeft, Send, Smile, SmilePlus } from "lucide-react";

import { Avatar } from "../design-system/components/Avatar";
import { useAuth } from "../context/useAuth";
import {
  DISCUSSION_REACTION_EMOJIS,
  discussionRoomIdFromScope,
  markDiscussionRoomRead,
  type DiscussionMessage,
} from "../lib/discussion-api";
import {
  useDiscussion,
  type DiscussionPresenceUser,
  type DiscussionReadReceipt,
  type DiscussionStatus,
} from "../lib/useEventDiscussion";
import { formatRelativeTimestamp } from "../lib/format-datetime";
import { AppIcon } from "./ui/AppIcon";
import { Card } from "./ui/Card";

const MAX_CONTENT_LENGTH = 2000;
const CHAR_COUNT_THRESHOLD = 1800;
const MAX_VISIBLE_AVATARS = 4;
const GROUP_GAP_MS = 5 * 60 * 1000;
const LONG_PRESS_MS = 450;

const COMPOSER_EMOJIS = ["😀", "😊", "😂", "🎉", "👍", "❤️", "🙏", "🔥"] as const;

type DiscussionScope =
  | { type: "event"; eventId: number }
  | { type: "board" }
  | { type: "room"; roomId: number };

type DiscussionFeedProps = {
  title: string;
  description?: string;
  emptyLabel?: string;
  scope: DiscussionScope;
  className?: string;
  /** Full-height messaging pane vs embedded card (event detail). */
  variant?: "pane" | "card";
  onBack?: () => void;
  headerAction?: ReactNode;
};

type TimelineItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      message: DiscussionMessage;
      showMeta: boolean;
      isOwn: boolean;
      isLastInGroup: boolean;
    };

function ConnectionStatusBadge({ status }: { status: DiscussionStatus }) {
  if (status === "closed") {
    return null;
  }

  const isLive = status === "live";
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting"
        ? "Reconnecting…"
        : "Connecting…";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-label"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={[
          "h-1.5 w-1.5 rounded-full",
          isLive ? "bg-success" : "bg-marigold animate-pulse",
        ].join(" ")}
      />
      {label}
    </span>
  );
}

function PresenceAvatarStack({ users }: { users: DiscussionPresenceUser[] }) {
  if (users.length === 0) {
    return null;
  }

  const visible = users.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = users.length - visible.length;

  return (
    <div
      className="flex items-center"
      aria-label={`${users.length} people in this discussion`}
    >
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <Avatar
            key={user.user_id}
            name={user.full_name}
            size="sm"
            className="ring-2 ring-white"
            title={user.full_name}
          />
        ))}
      </div>
      {overflow > 0 ? (
        <span className="ml-2 text-xs font-medium text-label">+{overflow}</span>
      ) : null}
    </div>
  );
}

function TypingIndicator({ users }: { users: DiscussionPresenceUser[] }) {
  if (users.length === 0) {
    return null;
  }

  const names = users.map((user) => user.full_name);
  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing…`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing…`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing…`;
  }

  return (
    <p className="px-1 text-xs text-label" role="status" aria-live="polite">
      {label}
    </p>
  );
}

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

export function buildDiscussionTimeline(
  messages: DiscussionMessage[],
  viewerUserId: number | null,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let lastDay: string | null = null;
  let lastAuthorId: number | null = null;
  let lastCreatedMs = 0;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const day = discussionDayKey(message.created_at);
    const createdMs = new Date(message.created_at).getTime();

    if (day !== lastDay) {
      items.push({
        kind: "day",
        key: day,
        label: formatDayLabel(message.created_at),
      });
      lastDay = day;
      lastAuthorId = null;
    }

    const sameAuthor = message.author.id === lastAuthorId;
    const closeInTime = createdMs - lastCreatedMs < GROUP_GAP_MS;
    const showMeta = !(sameAuthor && closeInTime);
    lastAuthorId = message.author.id;
    lastCreatedMs = createdMs;

    const next = messages[index + 1];
    let isLastInGroup = true;
    if (next) {
      const nextDay = discussionDayKey(next.created_at);
      const nextMs = new Date(next.created_at).getTime();
      isLastInGroup = !(
        nextDay === day &&
        next.author.id === message.author.id &&
        nextMs - createdMs < GROUP_GAP_MS
      );
    }

    items.push({
      kind: "message",
      message,
      showMeta,
      isOwn: viewerUserId != null && message.author.id === viewerUserId,
      isLastInGroup,
    });
  }

  return items;
}

function MessageReactions({
  message,
  disabled,
  onToggle,
  align,
  forceShowTrigger = false,
  onDismissForceShow,
}: {
  message: DiscussionMessage;
  disabled: boolean;
  onToggle: (messageId: number, emoji: string) => void;
  align: "left" | "right";
  forceShowTrigger?: boolean;
  onDismissForceShow?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const prevCountsRef = useRef<Record<string, number> | null>(null);
  const [bounceKeys, setBounceKeys] = useState<Record<string, number>>({});
  const reactions = message.reactions ?? {};
  const reactionEntries = Object.entries(reactions).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const showTrigger = pickerOpen || forceShowTrigger;

  useEffect(() => {
    prevCountsRef.current = null;
    setBounceKeys({});
  }, [message.id]);

  useEffect(() => {
    const snapshot = Object.fromEntries(
      Object.entries(reactions).map(([emoji, summary]) => [emoji, summary.count]),
    );
    if (prevCountsRef.current == null) {
      prevCountsRef.current = snapshot;
      return;
    }
    const prev = prevCountsRef.current;
    setBounceKeys((current) => {
      let changed = false;
      const next = { ...current };
      for (const [emoji, count] of Object.entries(snapshot)) {
        const prior = prev[emoji] ?? 0;
        if (count !== prior) {
          next[emoji] = (current[emoji] ?? 0) + 1;
          changed = true;
        }
      }
      for (const emoji of Object.keys(prev)) {
        if (!(emoji in snapshot)) {
          next[emoji] = (current[emoji] ?? 0) + 1;
          changed = true;
        }
      }
      return changed ? next : current;
    });
    prevCountsRef.current = snapshot;
  }, [message.id, reactions]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setPickerOpen(false);
        onDismissForceShow?.();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [pickerOpen, onDismissForceShow]);

  function closePicker() {
    setPickerOpen(false);
    onDismissForceShow?.();
  }

  return (
    <div
      className={[
        "absolute -bottom-2.5 z-[1] flex flex-wrap items-center gap-0.5",
        align === "right" ? "right-1" : "left-1",
      ].join(" ")}
    >
      {reactionEntries.map(([emoji, summary]) => (
        <button
          key={`${emoji}-${bounceKeys[emoji] ?? 0}`}
          type="button"
          disabled={disabled}
          aria-pressed={summary.reacted_by_me}
          aria-label={`${emoji} ${summary.count}${summary.reacted_by_me ? ", you reacted" : ""}`}
          onClick={() => onToggle(message.id, emoji)}
          className={[
            "discussion-reaction-pill inline-flex items-center gap-0.5 rounded-full border bg-white px-1.5 py-0.5 text-[11px] font-medium shadow-sm transition duration-150",
            bounceKeys[emoji] ? "discussion-reaction-pill-bounce" : "",
            summary.reacted_by_me
              ? "border-primary bg-badge-teal-bg text-primary ring-1 ring-primary/25"
              : "border-gray-200 text-gray-600 hover:border-gray-300",
            disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <span aria-hidden="true">{emoji}</span>
          <span className="tabular-nums">{summary.count}</span>
        </button>
      ))}

      <div
        className={[
          "relative transition-opacity duration-150",
          showTrigger
            ? "opacity-100"
            : "opacity-0 pointer-events-none sm:pointer-events-auto sm:opacity-0 sm:group-hover/bubble:opacity-100 sm:group-focus-within/bubble:opacity-100 sm:group-hover/bubble:pointer-events-auto sm:group-focus-within/bubble:pointer-events-auto",
        ].join(" ")}
        ref={pickerRef}
      >
        <button
          type="button"
          disabled={disabled}
          aria-label="Add reaction"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-label shadow-sm transition",
            "hover:border-gray-300 hover:bg-surface-muted hover:text-foreground",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            pickerOpen ? "border-gray-300 bg-surface-muted text-foreground" : "",
            disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <AppIcon icon={SmilePlus} size="xs" className="text-current" />
        </button>

        {pickerOpen ? (
          <div
            role="group"
            aria-label="Reaction picker"
            className={[
              "discussion-reaction-picker absolute bottom-full z-10 mb-1.5 flex gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-card",
              align === "right" ? "right-0" : "left-0",
            ].join(" ")}
          >
            {DISCUSSION_REACTION_EMOJIS.map((emoji) => {
              const mine = Boolean(reactions[emoji]?.reacted_by_me);
              return (
                <button
                  key={emoji}
                  type="button"
                  disabled={disabled}
                  aria-label={
                    mine ? `Remove ${emoji} reaction` : `React with ${emoji}`
                  }
                  aria-pressed={mine}
                  onClick={() => {
                    onToggle(message.id, emoji);
                    closePicker();
                  }}
                  className={[
                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-surface-muted",
                    mine ? "bg-badge-teal-bg ring-1 ring-primary/30" : "",
                  ].join(" ")}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SeenByIndicator({ readers }: { readers: DiscussionReadReceipt[] }) {
  if (readers.length === 0) {
    return null;
  }

  const label =
    readers.length === 1
      ? `Seen by ${readers[0].full_name}`
      : `Seen by ${readers.map((reader) => reader.full_name).join(", ")}`;

  return (
    <p
      className="mt-1 text-right text-[10px] font-medium tracking-wide text-gray-400"
      aria-label={label}
      title={label}
    >
      {readers.length === 1 ? "Seen" : `Seen by ${readers.length}`}
    </p>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3" role="separator">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-[11px] font-medium tracking-wide text-gray-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function MessageBubble({
  message,
  showMeta,
  isOwn,
  isLastInGroup,
  onToggleReaction,
  reactionsDisabled,
  seenReaders,
  forceShowTrigger = false,
  onDismissForceShow,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onContextMenu,
}: {
  message: DiscussionMessage;
  showMeta: boolean;
  isOwn: boolean;
  isLastInGroup: boolean;
  onToggleReaction?: (messageId: number, emoji: string) => void;
  reactionsDisabled: boolean;
  seenReaders?: DiscussionReadReceipt[] | null;
  forceShowTrigger?: boolean;
  onDismissForceShow?: () => void;
  onTouchStart?: (event: ReactTouchEvent) => void;
  onTouchEnd?: (event: ReactTouchEvent) => void;
  onTouchMove?: (event: ReactTouchEvent) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}) {
  const hasReactions =
    onToggleReaction != null &&
    Object.keys(message.reactions ?? {}).length > 0;

  return (
    <div
      className={[
        "group/bubble flex w-full",
        isOwn ? "justify-end" : "justify-start",
        showMeta ? "mt-3" : "mt-0.5",
        isLastInGroup || hasReactions || forceShowTrigger ? "mb-3" : "mb-0",
      ].join(" ")}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onTouchMove={onTouchMove}
      onContextMenu={onContextMenu}
    >
      <div
        className={[
          "flex max-w-[65%] gap-2",
          isOwn ? "flex-row-reverse" : "flex-row",
        ].join(" ")}
      >
        {!isOwn ? (
          <div className="w-7 shrink-0 pt-0.5">
            {showMeta ? (
              <Avatar name={message.author.full_name} size="sm" />
            ) : null}
          </div>
        ) : null}

        <div className={["min-w-0", isOwn ? "items-end" : "items-start"].join(" ")}>
          {showMeta && !isOwn ? (
            <div className="mb-1 flex items-baseline gap-2 px-1">
              <span className="text-xs font-medium text-foreground">
                {message.author.full_name}
              </span>
              <time
                dateTime={message.created_at}
                className="text-[10px] text-gray-400"
                title={new Date(message.created_at).toLocaleString()}
              >
                {formatRelativeTimestamp(message.created_at)}
              </time>
            </div>
          ) : null}

          <div className="relative">
            <div
              className={[
                "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                isOwn
                  ? "rounded-br-md bg-badge-teal-bg text-foreground"
                  : "rounded-bl-md bg-gray-100 text-foreground",
              ].join(" ")}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {isOwn && showMeta ? (
                <time
                  dateTime={message.created_at}
                  className="mt-1 block text-right text-[10px] text-primary/70"
                  title={new Date(message.created_at).toLocaleString()}
                >
                  {formatRelativeTimestamp(message.created_at)}
                </time>
              ) : null}
            </div>

            {onToggleReaction ? (
              <MessageReactions
                message={message}
                disabled={reactionsDisabled}
                onToggle={onToggleReaction}
                align={isOwn ? "right" : "left"}
                forceShowTrigger={forceShowTrigger}
                onDismissForceShow={onDismissForceShow}
              />
            ) : null}
          </div>

          {seenReaders && seenReaders.length > 0 ? (
            <SeenByIndicator readers={seenReaders} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Composer({
  scopeKey,
  draft,
  setDraft,
  posting,
  sendDisabled,
  errorMessage,
  onSubmit,
}: {
  scopeKey: string;
  draft: string;
  setDraft: (value: string) => void;
  posting: boolean;
  sendDisabled: boolean;
  errorMessage: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedLength = draft.trim().length;
  const canSend = trimmedLength > 0 && !posting && !sendDisabled;

  useEffect(() => {
    if (!emojiOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [emojiOpen]);

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft(`${draft}${emoji}`);
      setEmojiOpen(false);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="shrink-0 border-t border-gray-200 p-3">
      {errorMessage ? (
        <p className="mb-2 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <label className="sr-only" htmlFor={`discussion-message-${scopeKey}`}>
        Message
      </label>
      <div className="relative flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            id={`discussion-message-${scopeKey}`}
            rows={1}
            maxLength={MAX_CONTENT_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message…"
            className="max-h-32 min-h-10 w-full resize-none rounded-full border border-gray-200 bg-surface-card py-2.5 pl-4 pr-11 text-sm text-foreground shadow-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <div className="absolute bottom-1.5 right-1.5" ref={emojiRef}>
            <button
              type="button"
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((open) => !open)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-foreground"
            >
              <AppIcon icon={Smile} size="sm" />
            </button>
            {emojiOpen ? (
              <div
                role="group"
                aria-label="Emoji picker"
                className="absolute bottom-full right-0 z-10 mb-2 flex gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-card"
              >
                {COMPOSER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Insert ${emoji}`}
                    onClick={() => insertEmoji(emoji)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-surface-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={[
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition",
            canSend
              ? "bg-primary text-white hover:bg-primary/90"
              : "bg-gray-100 text-gray-400",
          ].join(" ")}
        >
          <AppIcon icon={Send} size="sm" />
        </button>
      </div>
      {trimmedLength > CHAR_COUNT_THRESHOLD ? (
        <p className="mt-1.5 text-right text-xs text-label">
          {trimmedLength}/{MAX_CONTENT_LENGTH}
        </p>
      ) : null}
    </form>
  );
}

function DiscussionShell({
  title,
  description,
  className,
  variant,
  onBack,
  headerAction,
  scopeKey,
  messages,
  loading,
  loadError,
  emptyLabel,
  draft,
  setDraft,
  posting,
  errorMessage,
  onSubmit,
  bottomRef,
  listRef,
  onListScroll,
  statusBadge,
  presence,
  typing,
  sendDisabled = false,
  onToggleReaction,
  reactionsDisabled = false,
  seenIndicator = null,
  viewerUserId,
}: {
  title: string;
  description?: string;
  className: string;
  variant: "pane" | "card";
  onBack?: () => void;
  headerAction?: ReactNode;
  scopeKey: string;
  messages: DiscussionMessage[];
  loading: boolean;
  loadError: string | null;
  emptyLabel: string;
  draft: string;
  setDraft: (value: string) => void;
  posting: boolean;
  errorMessage: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
  listRef?: RefObject<HTMLDivElement | null>;
  onListScroll?: () => void;
  statusBadge?: ReactNode;
  presence?: ReactNode;
  typing?: ReactNode;
  sendDisabled?: boolean;
  onToggleReaction?: (messageId: number, emoji: string) => void;
  reactionsDisabled?: boolean;
  seenIndicator?: {
    messageId: number;
    readers: DiscussionReadReceipt[];
  } | null;
  viewerUserId: number | null;
}) {
  const timeline = buildDiscussionTimeline(messages, viewerUserId);
  const isPane = variant === "pane";
  const [longPressedMessageId, setLongPressedMessageId] = useState<
    number | null
  >(null);
  const longPressTimerRef = useRef<number | null>(null);

  function clearLongPressTimer() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleMessageTouchStart(messageId: number) {
    if (!onToggleReaction) {
      return;
    }
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressedMessageId(messageId);
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  }

  function handleMessageTouchEnd() {
    clearLongPressTimer();
  }

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  const header = (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 px-3 sm:px-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to rooms"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition hover:bg-gray-100 md:hidden"
        >
          <AppIcon icon={ArrowLeft} size="sm" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            className="truncate text-sm font-medium text-foreground"
            title={description}
          >
            {title}
          </h2>
          {description ? (
            <span className="hidden truncate text-xs text-gray-400 sm:inline">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {headerAction}
        {presence}
        {statusBadge}
      </div>
    </div>
  );

  const body = (
    <>
      {header}
      <div
        ref={listRef}
        onScroll={onListScroll}
        className={[
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 sm:px-4",
          isPane ? "" : "max-h-96 min-h-48",
        ].join(" ")}
      >
        {loading ? (
          <p className="text-sm text-label">Loading discussion…</p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-overdue" role="alert">
            {loadError}
          </p>
        ) : null}

        {!loading && !loadError && messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-label">{emptyLabel}</p>
        ) : null}

        <div>
          {timeline.map((item) => {
            if (item.kind === "day") {
              return <DaySeparator key={`day-${item.key}`} label={item.label} />;
            }
            return (
              <MessageBubble
                key={item.message.id}
                message={item.message}
                showMeta={item.showMeta}
                isOwn={item.isOwn}
                isLastInGroup={item.isLastInGroup}
                onToggleReaction={onToggleReaction}
                reactionsDisabled={reactionsDisabled}
                seenReaders={
                  seenIndicator?.messageId === item.message.id
                    ? seenIndicator.readers
                    : null
                }
                forceShowTrigger={longPressedMessageId === item.message.id}
                onDismissForceShow={() => setLongPressedMessageId(null)}
                onTouchStart={() => handleMessageTouchStart(item.message.id)}
                onTouchEnd={handleMessageTouchEnd}
                onTouchMove={handleMessageTouchEnd}
                onContextMenu={(event) => {
                  if (!onToggleReaction) {
                    return;
                  }
                  event.preventDefault();
                  setLongPressedMessageId(item.message.id);
                }}
              />
            );
          })}
        </div>
        {typing}
        <div ref={bottomRef} />
      </div>

      <Composer
        scopeKey={scopeKey}
        draft={draft}
        setDraft={setDraft}
        posting={posting}
        sendDisabled={sendDisabled}
        errorMessage={errorMessage}
        onSubmit={onSubmit}
      />
    </>
  );

  if (isPane) {
    return (
      <section
        className={["flex h-full min-h-0 flex-col bg-white", className]
          .filter(Boolean)
          .join(" ")}
        aria-label={title}
      >
        {body}
      </section>
    );
  }

  return (
    <Card
      padding="none"
      className={["flex flex-col overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      {body}
    </Card>
  );
}

function LiveDiscussionFeed({
  title,
  description,
  emptyLabel,
  className,
  scope,
  variant,
  onBack,
  headerAction,
}: {
  title: string;
  description?: string;
  emptyLabel: string;
  className: string;
  scope: DiscussionScope;
  variant: "pane" | "card";
  onBack?: () => void;
  headerAction?: ReactNode;
}) {
  const { member } = useAuth();
  const {
    messages,
    presentUsers,
    typingUsers,
    seenIndicator,
    status,
    error,
    loading,
    sendMessage,
    toggleReaction,
    markLatestAsRead,
    notifyTypingActivity,
  } = useDiscussion(scope, { viewerUserId: member?.id ?? null });
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const scopeKey =
    scope.type === "board"
      ? "board"
      : scope.type === "event"
        ? `event:${scope.eventId}`
        : `room:${scope.roomId}`;
  const othersTyping = typingUsers.filter(
    (user) => user.user_id !== member?.id,
  );

  useEffect(() => {
    const roomId = discussionRoomIdFromScope(scope);
    void markDiscussionRoomRead(roomId).catch(() => {
      // Inbox unread is best-effort; thread UX must not fail if mark-read fails.
    });
  }, [scopeKey]);

  useEffect(() => {
    if (!nearBottomRef.current) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    markLatestAsRead();
  }, [messages.length, othersTyping.length, markLatestAsRead]);

  useEffect(() => {
    setDraft("");
    setErrorMessage(null);
  }, [scopeKey]);

  function handleListScroll() {
    const el = listRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 64;
    nearBottomRef.current = nearBottom;
    if (nearBottom) {
      markLatestAsRead();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting || status !== "live") {
      return;
    }

    setPosting(true);
    setErrorMessage(null);

    try {
      sendMessage(content);
      setDraft("");
      nearBottomRef.current = true;
      markLatestAsRead();
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Failed to send message",
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <DiscussionShell
      title={title}
      description={description}
      className={className}
      variant={variant}
      onBack={onBack}
      headerAction={headerAction}
      scopeKey={scopeKey}
      messages={messages}
      loading={loading}
      loadError={error}
      emptyLabel={emptyLabel}
      draft={draft}
      setDraft={(value) => {
        setDraft(value);
        if (value.trim()) {
          notifyTypingActivity();
        }
      }}
      posting={posting}
      errorMessage={errorMessage}
      onSubmit={handleSubmit}
      bottomRef={bottomRef}
      listRef={listRef}
      onListScroll={handleListScroll}
      statusBadge={<ConnectionStatusBadge status={status} />}
      presence={<PresenceAvatarStack users={presentUsers} />}
      typing={<TypingIndicator users={othersTyping} />}
      sendDisabled={status !== "live"}
      onToggleReaction={toggleReaction}
      reactionsDisabled={status !== "live"}
      seenIndicator={seenIndicator}
      viewerUserId={member?.id ?? null}
    />
  );
}

export function DiscussionFeed({
  title,
  description,
  emptyLabel = "No messages yet. Start the conversation.",
  scope,
  className = "",
  variant = "card",
  onBack,
  headerAction,
}: DiscussionFeedProps) {
  return (
    <LiveDiscussionFeed
      title={title}
      description={description}
      emptyLabel={emptyLabel}
      className={className}
      scope={scope}
      variant={variant}
      onBack={onBack}
      headerAction={headerAction}
    />
  );
}
