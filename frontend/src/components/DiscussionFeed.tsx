import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Forward,
  Link2,
  Megaphone,
  Mic,
  MessagesSquare,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  Play,
  Reply,
  Search,
  Send,
  Smile,
  SmilePlus,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router";

import { Avatar } from "../design-system/components/Avatar";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import type { MemberResponse } from "../lib/auth-api";
import {
  audioExtensionForMimeType,
  formatRecordingClock,
  loadComposerGifs,
  pickMediaRecorderMimeType,
  type ComposerGif,
} from "../lib/discussion-composer-media";
import {
  DISCUSSION_REACTION_EMOJIS,
  discussionRoomIdFromScope,
  markDiscussionRoomRead,
  uploadDiscussionAttachment,
  type DiscussionAttachment,
  type DiscussionAttachmentUpload,
  type DiscussionMessage,
  type DiscussionMessageAuthor,
  type DiscussionPinnedMessage,
  type DiscussionReactionSummary,
} from "../lib/discussion-api";
import {
  applyMentionCompletion,
  detectMentionQuery,
  messagePermalink,
  type MentionQuery,
} from "../lib/discussion-mentions";
import { DiscussionRichPreviews } from "../lib/discussion-rich-previews";
import {
  DISCUSSION_STICKERS,
  isStickerOnlyMessage,
} from "../lib/discussion-stickers";
import { buildDiscussionTimeline } from "../lib/discussion-timeline";
import { fetchMyEventTasks } from "../lib/event-tasks-api";
import {
  fetchEvent,
  fetchUpcomingEvents,
  type EventDetailResponse,
  type EventResponse,
} from "../lib/events-api";
import { linkifyText } from "../lib/linkify-text";
import { fetchMemberById, fetchMembers } from "../lib/members-api";
import {
  useDiscussion,
  type DiscussionPresenceUser,
  type DiscussionReadReceipt,
  type DiscussionStatus,
} from "../lib/useEventDiscussion";
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";
import { ForwardMessageModal } from "./discussions/ForwardMessageModal";
import { AppIcon } from "./ui/AppIcon";
import { Card } from "./ui/Card";

const MAX_CONTENT_LENGTH = 2000;
const CHAR_COUNT_THRESHOLD = 1800;
const LONG_PRESS_MS = 450;
/** Matches backend MESSAGE_EDIT_WINDOW_SECONDS (15 minutes). */
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Below this, render in normal flow — absolute virtual rows cause empty gaps on short threads. */
const VIRTUALIZE_TIMELINE_AFTER = 48;

const COMPOSER_EMOJIS = ["😀", "😊", "😂", "🎉", "👍", "❤️", "🙏", "🔥"] as const;

const EMPTY_REACTIONS: Record<string, DiscussionReactionSummary> = {};

function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VoiceAttachment({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationLabel, setDurationLabel] = useState("0:00");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    function onTime() {
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        return;
      }
      setProgress((audio.currentTime / audio.duration) * 100);
    }
    function onMeta() {
      if (!audio || !Number.isFinite(audio.duration)) {
        return;
      }
      const total = Math.round(audio.duration);
      setDurationLabel(
        `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`,
      );
    }
    function onEnded() {
      setPlaying(false);
      setProgress(0);
    }
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [url]);

  return (
    <div className="discussion-voice">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden">
        <track kind="captions" />
      </audio>
      <button
        type="button"
        aria-label={playing ? `Pause ${fileName}` : `Play ${fileName}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) {
            return;
          }
          if (playing) {
            audio.pause();
            setPlaying(false);
          } else {
            void audio.play().then(() => setPlaying(true)).catch(() => {
              setPlaying(false);
            });
          }
        }}
      >
        <AppIcon
          icon={playing ? Square : Play}
          size="xs"
          className={playing ? "fill-current" : "ml-0.5"}
        />
      </button>
      <div
        className="discussion-voice__wave"
        style={{ ["--progress" as string]: `${progress}%` }}
        aria-hidden="true"
      />
      <span className="shrink-0 text-[11px] tabular-nums text-gray-500">
        {durationLabel}
      </span>
    </div>
  );
}

function MessageAttachments({
  attachments,
  isOwn,
}: {
  attachments: DiscussionAttachment[];
  isOwn: boolean;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mb-1 flex flex-col gap-1">
      {attachments.map((attachment) => {
        if (attachment.kind === "image") {
          return (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="-mx-1.5 -mt-1 mb-0.5 block overflow-hidden rounded-[10px]"
            >
              <img
                src={attachment.url}
                alt={attachment.file_name}
                className="max-h-72 max-w-full object-cover"
                loading="lazy"
              />
            </a>
          );
        }
        if (attachment.kind === "video") {
          return (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="-mx-1.5 -mt-1 mb-0.5 relative block overflow-hidden rounded-[10px] bg-black/80"
            >
              <video
                src={attachment.url}
                className="max-h-72 max-w-full"
                preload="metadata"
                muted
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                  <AppIcon icon={Play} size="sm" className="ml-0.5" />
                </span>
              </span>
            </a>
          );
        }
        if (attachment.kind === "audio") {
          return (
            <VoiceAttachment
              key={attachment.id}
              url={attachment.url}
              fileName={attachment.file_name}
            />
          );
        }
        const ext = attachment.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
        return (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            download={attachment.file_name}
            className={[
              "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
              isOwn
                ? "bg-white/50 hover:bg-white/70"
                : "bg-[#F4F7F6] hover:bg-[#EAF1EE]",
            ].join(" ")}
          >
            <span className="inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-white text-primary shadow-sm">
              <AppIcon icon={FileText} size="sm" />
              <span className="text-[8px] font-semibold tracking-wide text-gray-400">
                {ext.slice(0, 4)}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {attachment.file_name}
              </span>
              <span className="block text-[11px] text-gray-500">
                {formatAttachmentSize(attachment.size_bytes)}
              </span>
            </span>
            <AppIcon icon={Download} size="xs" className="shrink-0 text-gray-400" />
          </a>
        );
      })}
    </div>
  );
}

type DiscussionScope =
  | { type: "event"; eventId: number }
  | { type: "board" }
  | { type: "room"; roomId: number };

type DiscussionFeedProps = {
  title: string;
  description?: string;
  /** Stacked subtitle lines under the title (preferred over flat description). */
  descriptionLines?: string[];
  emptyLabel?: string;
  introCreatedLabel?: string;
  introVisibilityLabel?: string;
  scope: DiscussionScope;
  className?: string;
  /** Full-height messaging pane vs embedded card (event detail). */
  variant?: "pane" | "card";
  onBack?: () => void;
  headerAction?: ReactNode;
};

const LOAD_OLDER_TOP_PX = 80;
const LOAD_OLDER_DEBOUNCE_MS = 250;

function ConnectionStatusBadge({ status }: { status: DiscussionStatus }) {
  if (status === "closed" || status === "live") {
    return null;
  }

  const label =
    status === "reconnecting" ? "Reconnecting…" : "Connecting…";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-marigold"
      />
      {label}
    </span>
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
    <div
      className="flex items-center gap-2 px-1 py-1"
      role="status"
      aria-live="polite"
    >
      <span className="discussion-typing-dots inline-flex items-center gap-0.5" aria-hidden="true">
        <span className="h-1 w-1 rounded-full bg-gray-400" />
        <span className="h-1 w-1 rounded-full bg-gray-400" />
        <span className="h-1 w-1 rounded-full bg-gray-400" />
      </span>
      <p className="text-[12px] text-gray-500">{label}</p>
    </div>
  );
}

function authorId(author: DiscussionMessageAuthor): number {
  return Number(author.id);
}

function snippetText(content: string, max = 72): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max - 1)}…`;
}

function canEditOwnMessage(
  message: DiscussionMessage,
  viewerUserId: number | null,
): boolean {
  if (viewerUserId == null || message.is_deleted) {
    return false;
  }
  if (authorId(message.author) !== Number(viewerUserId)) {
    return false;
  }
  const ageMs = Date.now() - new Date(message.created_at).getTime();
  return ageMs >= 0 && ageMs <= MESSAGE_EDIT_WINDOW_MS;
}

function MessageReactions({
  message,
  disabled,
  onToggle,
  align,
  forceShowTrigger = false,
  onDismissForceShow,
  compact = false,
}: {
  message: DiscussionMessage;
  disabled: boolean;
  onToggle: (messageId: number, emoji: string) => void;
  align: "left" | "right";
  forceShowTrigger?: boolean;
  onDismissForceShow?: () => void;
  /** Hide the reaction row chrome until hover / force-show when there are no reactions. */
  compact?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const prevCountsRef = useRef<Record<string, number> | null>(null);
  const [bounceKeys, setBounceKeys] = useState<Record<string, number>>({});
  const reactions = message.reactions ?? EMPTY_REACTIONS;
  const reactionEntries = Object.entries(reactions).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const showTrigger = pickerOpen || forceShowTrigger;
  const hasReactions = reactionEntries.length > 0;

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
    if (forceShowTrigger) {
      setPickerOpen(true);
    }
  }, [forceShowTrigger]);

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

  if (compact && !hasReactions && !showTrigger) {
    // Absolutely positioned so the empty hover affordance doesn't steal
    // layout height (which threw off the message virtualizer).
    return (
      <div
        className={[
          "discussion-reaction-row discussion-reaction-row--compact absolute bottom-0 z-[1] flex -mb-1 translate-y-full transition-opacity duration-150",
          "opacity-0 pointer-events-none sm:pointer-events-auto sm:group-hover/bubble:opacity-100 sm:group-hover/bubble:pointer-events-auto sm:group-focus-within/bubble:opacity-100 sm:group-focus-within/bubble:pointer-events-auto",
          align === "right" ? "right-1 justify-end" : "left-1 justify-start",
        ].join(" ")}
        ref={pickerRef}
      >
        <button
          type="button"
          disabled={disabled}
          aria-label="Add reaction"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-label shadow-sm transition hover:border-gray-300 hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <AppIcon icon={SmilePlus} size="xs" className="text-current" />
        </button>
        {pickerOpen ? (
          <div
            role="group"
            aria-label="Reaction picker"
            onMouseDown={(event) => event.stopPropagation()}
            className={[
              "discussion-reaction-picker absolute bottom-full z-40 mb-1.5 flex gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-card",
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
    );
  }

  return (
    <div
      className={[
        "discussion-reaction-row flex flex-wrap items-center gap-1",
        showTrigger ? "relative z-40" : "",
        align === "right" ? "justify-end" : "justify-start",
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
            "discussion-reaction-pill inline-flex items-center gap-0.5 rounded-full border bg-white font-medium transition duration-150",
            bounceKeys[emoji] ? "discussion-reaction-pill-bounce" : "",
            summary.reacted_by_me
              ? "border-[#D7E8E3] text-primary"
              : "border-[#E8E8E6] text-gray-700 hover:bg-[#F7F7F6]",
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
            onMouseDown={(event) => event.stopPropagation()}
            className={[
              "discussion-reaction-picker absolute bottom-full z-40 mb-1.5 flex gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-card",
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

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2.5" role="separator">
      <span className="discussion-day-chip px-3 py-1 text-[12px] font-medium">
        {label}
      </span>
    </div>
  );
}

function MessageActionButton({
  label,
  onClick,
  active = false,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
        danger
          ? "text-gray-500 hover:bg-[#F5F5F4] hover:text-[var(--status-danger-text)]"
          : active
            ? "text-primary hover:bg-[#F5F5F4]"
            : "text-gray-500 hover:bg-[#F5F5F4] hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MessageActionsBar({
  message,
  isOwn,
  isPinned,
  showEdit,
  reactionsDisabled,
  onReplyMessage,
  onForwardMessage,
  onEditMessage,
  onPinMessage,
  onCopyMessageLink,
  onDeleteMessage,
  onToggleReaction,
}: {
  message: DiscussionMessage;
  isOwn: boolean;
  isPinned: boolean;
  showEdit: boolean;
  reactionsDisabled: boolean;
  onReplyMessage?: (message: DiscussionMessage) => void;
  onForwardMessage?: (message: DiscussionMessage) => void;
  onEditMessage?: (message: DiscussionMessage) => void;
  onPinMessage?: (messageId: number) => void;
  onCopyMessageLink?: (messageId: number) => void;
  onDeleteMessage?: (messageId: number) => void;
  onToggleReaction?: (messageId: number, emoji: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const reactions = message.reactions ?? EMPTY_REACTIONS;

  useEffect(() => {
    if (!moreOpen && !reactionOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        moreOpen &&
        moreRef.current &&
        !moreRef.current.contains(target)
      ) {
        setMoreOpen(false);
      }
      if (
        reactionOpen &&
        reactionRef.current &&
        !reactionRef.current.contains(target)
      ) {
        setReactionOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [moreOpen, reactionOpen]);

  const menuOpen = moreOpen || reactionOpen;

  return (
    <div
      className={[
        // pb bridges the hover gap so the bar stays open while moving onto it.
        "discussion-msg-actions absolute -top-9 z-30 flex items-start pb-2",
        menuOpen ? "discussion-msg-actions--open" : "",
        isOwn ? "right-0" : "left-0",
      ].join(" ")}
    >
      <div className="relative flex items-center gap-0.5 rounded-full border border-[#E8E8E6] bg-white p-0.5 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
        {onToggleReaction && !reactionsDisabled ? (
          <div className="relative" ref={reactionRef}>
            <MessageActionButton
              label="Add reaction"
              active={reactionOpen}
              onClick={() => {
                setMoreOpen(false);
                setReactionOpen((open) => !open);
              }}
            >
              <AppIcon icon={SmilePlus} size="xs" />
            </MessageActionButton>
            {reactionOpen ? (
              <div
                role="group"
                aria-label="Reaction picker"
                onMouseDown={(event) => event.stopPropagation()}
                className={[
                  "discussion-reaction-picker absolute bottom-full z-40 mb-1.5 flex gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-card",
                  isOwn ? "right-0" : "left-0",
                ].join(" ")}
              >
                {DISCUSSION_REACTION_EMOJIS.map((emoji) => {
                  const mine = Boolean(reactions[emoji]?.reacted_by_me);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={
                        mine ? `Remove ${emoji} reaction` : `React with ${emoji}`
                      }
                      aria-pressed={mine}
                      onClick={() => {
                        onToggleReaction(message.id, emoji);
                        setReactionOpen(false);
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
        ) : null}
        {onReplyMessage && !reactionsDisabled ? (
          <MessageActionButton
            label="Reply"
            onClick={() => onReplyMessage(message)}
          >
            <AppIcon icon={Reply} size="xs" />
          </MessageActionButton>
        ) : null}
        {onForwardMessage && !reactionsDisabled ? (
          <MessageActionButton
            label="Forward message"
            onClick={() => onForwardMessage(message)}
          >
            <AppIcon icon={Forward} size="xs" />
          </MessageActionButton>
        ) : null}
        {onPinMessage && !reactionsDisabled ? (
          <MessageActionButton
            label={isPinned ? "Pinned" : "Pin message"}
            active={isPinned}
            onClick={() => onPinMessage(message.id)}
          >
            <AppIcon icon={Pin} size="xs" />
          </MessageActionButton>
        ) : null}
        {onCopyMessageLink ? (
          <MessageActionButton
            label="Copy link"
            onClick={() => onCopyMessageLink(message.id)}
          >
            <AppIcon icon={Link2} size="xs" />
          </MessageActionButton>
        ) : null}
        <div className="relative" ref={moreRef}>
          <MessageActionButton
            label="More actions"
            active={moreOpen}
            onClick={() => {
              setReactionOpen(false);
              setMoreOpen((open) => !open);
            }}
          >
            <AppIcon icon={MoreVertical} size="xs" />
          </MessageActionButton>
          {moreOpen ? (
            <div
              role="menu"
              onMouseDown={(event) => event.stopPropagation()}
              className={[
                "absolute bottom-full z-40 mb-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-[#EBEBEA] bg-white py-1 shadow-sm",
                isOwn ? "right-0" : "left-0",
              ].join(" ")}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-[#F5F5F4]"
                onClick={() => {
                  void navigator.clipboard?.writeText(message.content);
                  setMoreOpen(false);
                }}
              >
                <AppIcon icon={Copy} size="xs" />
                Copy text
              </button>
              {showEdit && onEditMessage ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-[#F5F5F4]"
                  onClick={() => {
                    onEditMessage(message);
                    setMoreOpen(false);
                  }}
                >
                  <AppIcon icon={Pencil} size="xs" />
                  Edit
                </button>
              ) : null}
              {isOwn && onDeleteMessage && !reactionsDisabled ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--status-danger-text)] hover:bg-[#F5F5F4]"
                  onClick={() => {
                    setMoreOpen(false);
                    if (
                      window.confirm("Delete this message for everyone?")
                    ) {
                      onDeleteMessage(message.id);
                    }
                  }}
                >
                  <AppIcon icon={Trash2} size="xs" />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const AUTHOR_NAME_COLORS = [
  "#0F766E",
  "#C2410C",
  "#7C3AED",
  "#0369A1",
  "#B45309",
  "#BE185D",
  "#15803D",
  "#4338CA",
] as const;

function authorNameColor(author: DiscussionMessageAuthor): string {
  const seed = `${author.id}:${author.full_name}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AUTHOR_NAME_COLORS[hash % AUTHOR_NAME_COLORS.length]!;
}

function UnreadSeparator() {
  return (
    <div
      className="flex items-center justify-center gap-2 py-2"
      role="separator"
      aria-label="Unread messages"
    >
      <div className="h-px w-8 bg-[#F0C7C0]" />
      <span className="shrink-0 px-1 text-[11px] font-semibold tracking-wide text-[#C45C4A]">
        Unread messages
      </span>
      <div className="h-px w-8 bg-[#F0C7C0]" />
    </div>
  );
}

function DiscussionIntro({
  title,
  createdLabel,
  visibilityLabel,
}: {
  title: string;
  createdLabel?: string;
  visibilityLabel?: string;
}) {
  return (
    <div className="discussion-msg-column mx-auto mb-2 px-2 py-4 text-center">
      <div className="mb-3 h-px bg-[#F0F0EE]" />
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      {createdLabel ? (
        <p className="mt-0.5 text-[12px] text-gray-500">{createdLabel}</p>
      ) : null}
      {visibilityLabel ? (
        <p className="mt-0.5 text-[12px] text-gray-400">{visibilityLabel}</p>
      ) : null}
      <div className="mt-3 h-px bg-[#F0F0EE]" />
    </div>
  );
}

function EventContextStrip({ eventId }: { eventId: number }) {
  const [event, setEvent] = useState<EventDetailResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEvent(eventId)
      .then((detail) => {
        if (!cancelled) {
          setEvent(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvent(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!event) {
    return null;
  }

  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(event.starts_at));
  const taskCount = event.prep_tasks?.length ?? 0;
  const doneCount =
    event.prep_tasks?.filter((task) => task.is_complete).length ?? 0;

  return (
    <div className="shrink-0 border-b border-[#F0F0EE] px-3 py-2 sm:px-5">
      <Link
        to={`/events/${eventId}`}
        className="discussion-msg-column flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-[#FAFAF9]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {event.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <AppIcon icon={CalendarDays} size="xs" className="text-current" />
              {dateLabel}
            </span>
            {taskCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <AppIcon icon={CheckSquare} size="xs" className="text-current" />
                {doneCount}/{taskCount} tasks
              </span>
            ) : null}
            {event.capacity != null ? (
              <span className="inline-flex items-center gap-1">
                <AppIcon icon={Users} size="xs" className="text-current" />
                Cap {event.capacity}
              </span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary">
          Open
          <AppIcon icon={ChevronRight} size="xs" className="text-current" />
        </span>
      </Link>
    </div>
  );
}

type MessageGroupSharedProps = {
  onToggleReaction?: (messageId: number, emoji: string) => void;
  reactionsDisabled: boolean;
  seenIndicator?: { messageId: number; readers: DiscussionReadReceipt[] } | null;
  longPressedMessageId: number | null;
  onDismissForceShow?: () => void;
  onMessageTouchStart: (messageId: number) => void;
  onMessageTouchEnd: () => void;
  onMessageContextMenu: (messageId: number, event: React.MouseEvent) => void;
  onAuthorClick?: (author: DiscussionMessageAuthor) => void;
  onDeleteMessage?: (messageId: number) => void;
  onReplyMessage?: (message: DiscussionMessage) => void;
  onEditMessage?: (message: DiscussionMessage) => void;
  onPinMessage?: (messageId: number) => void;
  onForwardMessage?: (message: DiscussionMessage) => void;
  onCopyMessageLink?: (messageId: number) => void;
  viewerUserId: number | null;
  pinnedMessageId?: number | null;
};

function MessageGroup({
  author,
  isOwn,
  messages,
  onToggleReaction,
  reactionsDisabled,
  seenIndicator,
  longPressedMessageId,
  onDismissForceShow,
  onMessageTouchStart,
  onMessageTouchEnd,
  onMessageContextMenu,
  onAuthorClick,
  onDeleteMessage,
  onReplyMessage,
  onEditMessage,
  onPinMessage,
  onForwardMessage,
  onCopyMessageLink,
  viewerUserId,
  pinnedMessageId,
}: {
  author: DiscussionMessageAuthor;
  isOwn: boolean;
  messages: DiscussionMessage[];
} & MessageGroupSharedProps) {
  const authorLabel = isOwn ? "You" : author.full_name;
  const nameColor = isOwn ? undefined : authorNameColor(author);

  return (
    <div
      className={[
        "discussion-msg-group flex w-full gap-1.5 px-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
      ].join(" ")}
    >
      {!isOwn ? (
        <div className="flex w-7 shrink-0 flex-col justify-end pb-0.5">
          {onAuthorClick ? (
            <button
              type="button"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              aria-label={`View ${author.full_name}'s profile`}
              onClick={() => onAuthorClick(author)}
            >
              <Avatar
                name={author.full_name}
                size="sm"
                tone="colorful"
                colorSeed={`user:${author.id}`}
                className="!h-7 !w-7 !rounded-full !text-[10px] !font-bold"
              />
            </button>
          ) : (
            <Avatar
              name={author.full_name}
              size="sm"
              tone="colorful"
              colorSeed={`user:${author.id}`}
              className="!h-7 !w-7 !rounded-full !text-[10px] !font-bold"
            />
          )}
        </div>
      ) : (
        <div className="w-1 shrink-0" aria-hidden="true" />
      )}

      <div
        className={[
          "flex min-w-0 max-w-[min(72%,34rem)] flex-col gap-px",
          isOwn ? "items-end" : "items-start",
        ].join(" ")}
      >
        {!isOwn ? (
          <div className="mb-px px-1">
            {onAuthorClick ? (
              <button
                type="button"
                className="discussion-author-name hover:underline focus-visible:outline-none"
                style={{ color: nameColor }}
                onClick={() => onAuthorClick(author)}
              >
                {authorLabel}
              </button>
            ) : (
              <span
                className="discussion-author-name"
                style={{ color: nameColor }}
              >
                {authorLabel}
              </span>
            )}
          </div>
        ) : null}

        {messages.map((message, index) => {
          const forceShow = longPressedMessageId === message.id;
          const hasReactions =
            onToggleReaction != null &&
            !message.is_deleted &&
            Object.keys(message.reactions ?? {}).length > 0;
          const isFirst = index === 0;
          const isLast = index === messages.length - 1;
          const clock = new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(message.created_at));
          const isSeen =
            isOwn &&
            seenIndicator?.messageId === message.id &&
            (seenIndicator.readers.length ?? 0) > 0;
          const showEdit =
            isOwn &&
            !reactionsDisabled &&
            canEditOwnMessage(message, viewerUserId);
          const isPinned = pinnedMessageId === message.id;
          const replyPreview = message.reply_to;
          const stickerOnly =
            !message.is_deleted && isStickerOnlyMessage(message.content);

          return (
            <Fragment key={message.id}>
              <div
                id={`discussion-msg-${message.id}`}
                data-message-id={message.id}
                className={[
                  "group/bubble relative max-w-full",
                  hasReactions ? "pb-1" : "",
                  forceShow ? "z-40" : "z-0",
                  isOwn ? "self-end" : "self-start",
                ].join(" ")}
                onTouchStart={() => onMessageTouchStart(message.id)}
                onTouchEnd={onMessageTouchEnd}
                onTouchCancel={onMessageTouchEnd}
                onTouchMove={onMessageTouchEnd}
                onContextMenu={(event) =>
                  onMessageContextMenu(message.id, event)
                }
              >
                {!message.is_deleted ? (
                  <MessageActionsBar
                    message={message}
                    isOwn={isOwn}
                    isPinned={isPinned}
                    showEdit={Boolean(showEdit)}
                    reactionsDisabled={reactionsDisabled}
                    onReplyMessage={onReplyMessage}
                    onForwardMessage={onForwardMessage}
                    onEditMessage={onEditMessage}
                    onPinMessage={onPinMessage}
                    onCopyMessageLink={onCopyMessageLink}
                    onDeleteMessage={onDeleteMessage}
                    onToggleReaction={onToggleReaction}
                  />
                ) : null}

                <div
                  className={[
                    "discussion-bubble relative text-[13px] leading-[1.3] text-foreground",
                    message.is_deleted
                      ? "discussion-bubble--deleted"
                      : isOwn
                        ? "discussion-bubble--out"
                        : "discussion-bubble--in",
                    !message.is_deleted && isFirst && isLast
                      ? "discussion-bubble--solo"
                      : !message.is_deleted && isFirst
                        ? isOwn
                          ? "discussion-bubble--out-first"
                          : "discussion-bubble--in-first"
                        : !message.is_deleted && isLast
                          ? isOwn
                            ? "discussion-bubble--out-last"
                            : "discussion-bubble--in-last"
                          : !message.is_deleted
                            ? isOwn
                              ? "discussion-bubble--out-mid"
                              : "discussion-bubble--in-mid"
                            : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {replyPreview && !message.is_deleted ? (
                    <div
                      className={[
                        "mb-1.5 rounded-md border-l-[3px] px-2 py-1",
                        isOwn
                          ? "border-primary/55 bg-white/45"
                          : "border-primary/45 bg-[#F1F6F4]",
                      ].join(" ")}
                    >
                      <p className="truncate text-[11px] font-semibold text-[#202020]">
                        {replyPreview.author_name}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {replyPreview.is_deleted
                          ? "Message deleted"
                          : snippetText(replyPreview.content, 90)}
                      </p>
                    </div>
                  ) : null}
                  {!message.is_deleted &&
                  (message.attachments?.length ?? 0) > 0 ? (
                    <MessageAttachments
                      attachments={message.attachments ?? []}
                      isOwn={isOwn}
                    />
                  ) : null}
                  {message.is_deleted ? (
                    <span className="italic text-[#8B9199]">
                      This message was deleted
                    </span>
                  ) : message.content.trim() ? (
                    <span
                      className={[
                        "whitespace-pre-wrap break-words",
                        stickerOnly ? "text-3xl leading-none" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {linkifyText(message.content)}
                    </span>
                  ) : null}
                  {!message.is_deleted ? (
                    <DiscussionRichPreviews content={message.content} />
                  ) : null}
                  {!message.is_deleted ? (
                    <span className="discussion-bubble__tail inline-flex items-end gap-1 pl-2 align-bottom">
                      {message.edited_at ? (
                        <span className="text-[10px] text-gray-400">edited</span>
                      ) : null}
                      <time
                        dateTime={message.created_at}
                        className="text-[10px] tabular-nums leading-none text-gray-400"
                        title={new Date(message.created_at).toLocaleString()}
                      >
                        {clock}
                      </time>
                      {isOwn ? (
                        <span
                          className="inline-flex text-primary/70"
                          title={isSeen ? "Seen" : "Sent"}
                          aria-label={isSeen ? "Seen" : "Sent"}
                        >
                          <AppIcon
                            icon={isSeen ? CheckCheck : Check}
                            size="xs"
                            className="!h-3 !w-3"
                          />
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>

                {onToggleReaction && !message.is_deleted ? (
                  <MessageReactions
                    message={message}
                    disabled={reactionsDisabled}
                    onToggle={onToggleReaction}
                    align={isOwn ? "right" : "left"}
                    forceShowTrigger={forceShow}
                    onDismissForceShow={onDismissForceShow}
                    compact={!hasReactions && !forceShow}
                  />
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

type MentionCandidate = {
  id: string;
  label: string;
  hint?: string;
  insertion: string;
};

function Composer({
  scopeKey,
  draft,
  setDraft,
  posting,
  sendDisabled,
  errorMessage,
  onSend,
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  forwardingHint = false,
}: {
  scopeKey: string;
  draft: string;
  setDraft: (value: string) => void;
  posting: boolean;
  sendDisabled: boolean;
  errorMessage: string | null;
  onSend: (payload: {
    content: string;
    attachments?: DiscussionAttachmentUpload[];
  }) => void | Promise<void>;
  replyTo?: DiscussionMessage | null;
  onCancelReply?: () => void;
  editingMessage?: DiscussionMessage | null;
  onCancelEdit?: () => void;
  forwardingHint?: boolean;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [gifs, setGifs] = useState<ComposerGif[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachHint, setAttachHint] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>(
    [],
  );
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const gifRef = useRef<HTMLDivElement>(null);
  const stickerRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingMimeRef = useRef<string>("audio/webm");
  const recordingTickRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const trimmedLength = draft.trim().length;
  const busy = posting || uploading || recording;
  const canSend =
    (trimmedLength > 0 || (!editingMessage && pendingFiles.length > 0)) &&
    !busy &&
    !sendDisabled;
  const isEditing = editingMessage != null;
  const showMic =
    !canSend &&
    !isEditing &&
    !busy &&
    !sendDisabled &&
    pendingFiles.length === 0 &&
    trimmedLength === 0;

  function stopRecordingTimer() {
    if (recordingTickRef.current != null) {
      window.clearInterval(recordingTickRef.current);
      recordingTickRef.current = null;
    }
  }

  function releaseMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function resetRecordingState() {
    stopRecordingTimer();
    releaseMediaStream();
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    setRecording(false);
    setRecordingSeconds(0);
  }

  function syncMentionFromCaret(nextDraft = draft) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? nextDraft.length;
    const nextMention = detectMentionQuery(nextDraft, cursor);
    setMention(nextMention);
    setMentionIndex(0);
  }

  function applyMention(candidate: MentionCandidate) {
    if (!mention) {
      return;
    }
    const { next, caret } = applyMentionCompletion(
      draft,
      mention,
      candidate.insertion,
    );
    setDraft(next);
    setMention(null);
    setMentionCandidates([]);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore stop races on unmount.
      }
      stopRecordingTimer();
      releaseMediaStream();
    };
  }, []);

  useEffect(() => {
    if (!emojiOpen && !gifOpen && !stickerOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (emojiOpen && emojiRef.current && !emojiRef.current.contains(target)) {
        setEmojiOpen(false);
      }
      if (gifOpen && gifRef.current && !gifRef.current.contains(target)) {
        setGifOpen(false);
      }
      if (
        stickerOpen &&
        stickerRef.current &&
        !stickerRef.current.contains(target)
      ) {
        setStickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [emojiOpen, gifOpen, stickerOpen]);

  useEffect(() => {
    if (!gifOpen) {
      return;
    }
    let cancelled = false;
    setGifsLoading(true);
    void loadComposerGifs(import.meta.env.VITE_TENOR_API_KEY)
      .then((result) => {
        if (!cancelled) {
          setGifs(result.gifs);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGifsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gifOpen]);

  useEffect(() => {
    if (replyTo != null || editingMessage != null) {
      textareaRef.current?.focus();
    }
  }, [replyTo?.id, editingMessage?.id]);

  useEffect(() => {
    if (!mention) {
      setMentionCandidates((current) => (current.length === 0 ? current : []));
      setMentionLoading(false);
      return;
    }
    const activeMention = mention;
    let cancelled = false;
    const query = activeMention.query.trim().toLowerCase();
    setMentionLoading(true);

    async function loadCandidates() {
      try {
        if (activeMention.kind === "member") {
          const page = await fetchMembers({
            status: "approved",
            page_size: 100,
          });
          if (cancelled) {
            return;
          }
          const rows = page.members
            .filter((member) =>
              query
                ? member.full_name.toLowerCase().includes(query)
                : true,
            )
            .slice(0, 8)
            .map((member) => ({
              id: `member-${member.id}`,
              label: member.full_name,
              hint: "Member",
              insertion: `@${member.full_name} `,
            }));
          setMentionCandidates(rows);
          return;
        }

        if (activeMention.kind === "event") {
          const [upcoming, myTasks] = await Promise.all([
            fetchUpcomingEvents({ limit: 40 })
              .then((response) => response.events)
              .catch(() => [] as EventResponse[]),
            fetchMyEventTasks()
              .then((response) => response.tasks)
              .catch(() => []),
          ]);
          if (cancelled) {
            return;
          }
          const eventRows = upcoming
            .filter((event) =>
              query ? event.name.toLowerCase().includes(query) : true,
            )
            .slice(0, 6)
            .map((event) => ({
              id: `event-${event.id}`,
              label: event.name,
              hint: "Event",
              insertion: `#${event.name} `,
            }));
          const taskRows = myTasks
            .filter(
              (task) =>
                query
                  ? task.title.toLowerCase().includes(query) ||
                    task.event_name.toLowerCase().includes(query)
                  : true,
            )
            .slice(0, 4)
            .map((task) => ({
              id: `task-${task.id}`,
              label: task.title,
              hint: task.event_name,
              insertion: `#${task.title} `,
            }));
          setMentionCandidates([...eventRows, ...taskRows].slice(0, 8));
          return;
        }

        // budget
        const upcoming = await fetchUpcomingEvents({ limit: 40 })
          .then((response) => response.events)
          .catch(() => [] as EventResponse[]);
        if (cancelled) {
          return;
        }
        const rows: MentionCandidate[] = [
          {
            id: "budget-generic",
            label: "$Budget",
            hint: "Budget",
            insertion: "$Budget ",
          },
          ...upcoming
            .filter((event) =>
              query
                ? event.name.toLowerCase().includes(query) ||
                  "budget".includes(query)
                : true,
            )
            .slice(0, 7)
            .map((event) => ({
              id: `budget-${event.id}`,
              label: `$Budget ${event.name}`,
              hint: "Budget",
              insertion: `$Budget ${event.name} `,
            })),
        ].filter((row) =>
          query
            ? row.label.toLowerCase().includes(query) ||
              row.label.toLowerCase().includes(`$budget ${query}`)
            : true,
        );
        setMentionCandidates(rows.slice(0, 8));
      } catch {
        if (!cancelled) {
          setMentionCandidates([]);
        }
      } finally {
        if (!cancelled) {
          setMentionLoading(false);
        }
      }
    }

    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [mention?.kind, mention?.query, mention?.start, mention?.end]);

  function queueFiles(files: FileList | File[]) {
    if (isEditing) {
      setAttachHint("Attachments can’t be added while editing a message.");
      return;
    }
    const list = Array.from(files).filter((file) => file.size > 0);
    if (list.length === 0) {
      return;
    }
    setPendingFiles((current) => [...current, ...list].slice(0, 8));
    setAttachHint(null);
  }

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
      syncMentionFromCaret(next);
    });
  }

  function insertAtMention() {
    const el = textareaRef.current;
    const token = "@";
    if (!el) {
      const next = `${draft}${token}`;
      setDraft(next);
      syncMentionFromCaret(next);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${token}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
      syncMentionFromCaret(next);
    });
  }

  async function sendSticker(emoji: string) {
    if (busy || isEditing || sendDisabled) {
      return;
    }
    setStickerOpen(false);
    setEmojiOpen(false);
    setGifOpen(false);
    await onSend({ content: emoji });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && mentionCandidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((index) => (index + 1) % mentionCandidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (index) =>
            (index - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const candidate = mentionCandidates[mentionIndex];
        if (candidate) {
          event.preventDefault();
          applyMention(candidate);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention(null);
        setMentionCandidates([]);
        return;
      }
    }
    if (event.key === "Escape") {
      if (isEditing) {
        event.preventDefault();
        onCancelEdit?.();
        return;
      }
      if (replyTo != null) {
        event.preventDefault();
        onCancelReply?.();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.files;
    if (items && items.length > 0) {
      event.preventDefault();
      queueFiles(items);
    }
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    const content = draft.trim();
    const filesToUpload = isEditing ? [] : [...pendingFiles];

    setUploading(true);
    setAttachHint(null);
    setUploadProgress(null);
    try {
      const attachments: DiscussionAttachmentUpload[] = [];
      for (let index = 0; index < filesToUpload.length; index += 1) {
        const file = filesToUpload[index];
        setUploadProgress(
          `Uploading ${index + 1} of ${filesToUpload.length}…`,
        );
        attachments.push(await uploadDiscussionAttachment(file));
      }
      setUploadProgress(null);
      await onSend({
        content,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setPendingFiles([]);
      setMention(null);
    } catch (caught) {
      setAttachHint(
        caught instanceof Error ? caught.message : "Failed to upload attachments",
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function startVoiceRecording() {
    if (busy || isEditing || sendDisabled) {
      return;
    }
    setAttachHint(null);
    setEmojiOpen(false);
    setGifOpen(false);
    setStickerOpen(false);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setAttachHint("Voice messages aren’t supported in this browser.");
      return;
    }
    const mimeType = pickMediaRecorderMimeType();
    if (!mimeType) {
      setAttachHint("Voice messages aren’t supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingMimeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const shouldDiscard = discardRecordingRef.current;
        const chunks = [...recordingChunksRef.current];
        const recordedMime = recordingMimeRef.current;
        resetRecordingState();
        if (shouldDiscard || chunks.length === 0) {
          return;
        }
        const blob = new Blob(chunks, { type: recordedMime.split(";")[0] });
        if (blob.size === 0) {
          setAttachHint("Recording was empty. Try again.");
          return;
        }
        const extension = audioExtensionForMimeType(recordedMime);
        const file = new File([blob], `voice-${Date.now()}.${extension}`, {
          type: blob.type || recordedMime.split(";")[0],
        });
        void (async () => {
          setUploading(true);
          setUploadProgress("Uploading voice message…");
          try {
            const attachment = await uploadDiscussionAttachment(file);
            await onSend({
              content: "",
              attachments: [attachment],
            });
          } catch (caught) {
            setAttachHint(
              caught instanceof Error
                ? caught.message
                : "Failed to send voice message",
            );
          } finally {
            setUploading(false);
            setUploadProgress(null);
          }
        })();
      };
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTickRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);
    } catch (caught) {
      resetRecordingState();
      const name =
        caught && typeof caught === "object" && "name" in caught
          ? String((caught as { name?: string }).name)
          : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setAttachHint("Microphone permission denied.");
      } else {
        setAttachHint(
          caught instanceof Error
            ? caught.message
            : "Couldn’t start voice recording.",
        );
      }
    }
  }

  function cancelVoiceRecording() {
    discardRecordingRef.current = true;
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      } else {
        resetRecordingState();
      }
    } catch {
      resetRecordingState();
    }
  }

  function stopVoiceRecording() {
    discardRecordingRef.current = false;
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
    } catch {
      resetRecordingState();
      setAttachHint("Couldn’t finish voice recording.");
    }
  }

  async function sendGif(gif: ComposerGif) {
    if (busy || isEditing || sendDisabled) {
      return;
    }
    setGifOpen(false);
    setEmojiOpen(false);
    setStickerOpen(false);
    setUploading(true);
    setAttachHint(null);
    setUploadProgress("Uploading GIF…");
    try {
      const response = await fetch(gif.url);
      if (!response.ok) {
        throw new Error("Failed to download GIF");
      }
      const blob = await response.blob();
      const type = blob.type || "image/gif";
      const file = new File([blob], `gif-${Date.now()}.gif`, { type });
      const attachment = await uploadDiscussionAttachment(file);
      await onSend({
        content: "",
        attachments: [attachment],
      });
    } catch (caught) {
      setAttachHint(
        caught instanceof Error ? caught.message : "Failed to send GIF",
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleFormSubmit(event);
      }}
      className="shrink-0 border-t border-[#EFEFEF] bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4"
      onDragEnter={(event) => {
        event.preventDefault();
        if (!recording) {
          setDragOver(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!recording) {
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) {
          return;
        }
        setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (!recording && event.dataTransfer.files?.length) {
          queueFiles(event.dataTransfer.files);
        }
      }}
    >
      {errorMessage ? (
        <p className="mb-2 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {attachHint ? (
        <p className="mb-2 text-[12px] text-overdue" role="status">
          {attachHint}
        </p>
      ) : null}
      {uploadProgress ? (
        <p className="mb-2 text-[12px] text-gray-500" role="status">
          {uploadProgress}
        </p>
      ) : null}
      {forwardingHint && !isEditing && replyTo == null ? (
        <p className="mb-2 text-[12px] font-medium text-primary" role="status">
          Forwarding…
        </p>
      ) : null}
      {isEditing ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#EBEBEA] bg-[#F7F7F6] px-2.5 py-2">
          <AppIcon icon={Pencil} size="xs" className="mt-0.5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-primary">Edit message</p>
            <p className="truncate text-[12px] text-gray-500">
              {snippetText(editingMessage.content)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel edit"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-foreground"
            onClick={onCancelEdit}
          >
            <AppIcon icon={X} size="xs" />
          </button>
        </div>
      ) : replyTo != null ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#EBEBEA] bg-[#F7F7F6] px-2.5 py-2">
          <AppIcon icon={Reply} size="xs" className="mt-0.5 text-primary" />
          <div className="min-w-0 flex-1 border-l-2 border-primary/40 pl-2">
            <p className="truncate text-[12px] font-semibold text-primary">
              {replyTo.author.full_name}
            </p>
            <p className="truncate text-[12px] text-gray-500">
              {replyTo.is_deleted
                ? "Message deleted"
                : snippetText(replyTo.content)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel reply"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-foreground"
            onClick={onCancelReply}
          >
            <AppIcon icon={X} size="xs" />
          </button>
        </div>
      ) : null}
      <label className="sr-only" htmlFor={`discussion-message-${scopeKey}`}>
        Message
      </label>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            queueFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />
      {pendingFiles.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {pendingFiles.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F5F5F4] px-2.5 py-1 text-[11px] text-gray-600"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="text-gray-400 hover:text-foreground"
                onClick={() =>
                  setPendingFiles((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {recording ? (
        <div
          className="flex items-center gap-2 rounded-[22px] border border-[#E4E4E3] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#D64545]"
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium tabular-nums text-foreground">
            {formatRecordingClock(recordingSeconds)}
          </span>
          <span className="flex-1 text-[12px] text-gray-500">Recording…</span>
          <button
            type="button"
            aria-label="Cancel recording"
            onClick={cancelVoiceRecording}
            className="inline-flex h-9 items-center justify-center rounded-full px-3 text-[13px] font-medium text-gray-600 transition hover:bg-[#F5F5F4] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label="Stop and send recording"
            onClick={stopVoiceRecording}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-white transition hover:bg-primary/90"
          >
            <AppIcon icon={Square} size="xs" className="fill-current" />
            Stop
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
        <div
          className={[
            "discussion-composer-shell relative flex min-w-0 flex-1 items-end gap-0.5 px-2 py-1.5 transition",
            dragOver
              ? "ring-1 ring-primary/30"
              : "focus-within:ring-1 focus-within:ring-primary/25",
          ].join(" ")}
        >
          {mention ? (
            <div
              ref={mentionRef}
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute bottom-full left-0 z-20 mb-2 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-[#EBEBEA] bg-white shadow-sm"
            >
              {mentionLoading ? (
                <p className="px-3 py-2 text-[12px] text-gray-500">
                  Searching…
                </p>
              ) : mentionCandidates.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-gray-500">
                  No matches
                </p>
              ) : (
                <ul className="max-h-52 overflow-y-auto py-1">
                  {mentionCandidates.map((candidate, index) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === mentionIndex}
                        className={[
                          "flex w-full flex-col items-start px-3 py-1.5 text-left transition",
                          index === mentionIndex
                            ? "bg-[#F3F7F5]"
                            : "hover:bg-[#F7F7F6]",
                        ].join(" ")}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyMention(candidate);
                        }}
                      >
                        <span className="text-[13px] font-medium text-foreground">
                          {candidate.label}
                        </span>
                        {candidate.hint ? (
                          <span className="text-[11px] text-gray-500">
                            {candidate.hint}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Attach file"
            title="Attach file"
            disabled={busy || isEditing}
            onClick={() => fileInputRef.current?.click()}
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#F3F3F2] hover:text-foreground disabled:opacity-40"
          >
            <AppIcon icon={Paperclip} size="sm" />
          </button>
          <div className="relative mb-0.5" ref={emojiRef}>
            <button
              type="button"
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
              disabled={busy}
              onClick={() => {
                setGifOpen(false);
                setStickerOpen(false);
                setEmojiOpen((open) => !open);
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#F3F3F2] hover:text-foreground disabled:opacity-40"
            >
              <AppIcon icon={Smile} size="sm" />
            </button>
            {emojiOpen ? (
              <div
                role="group"
                aria-label="Emoji picker"
                className="absolute bottom-full left-0 z-10 mb-2 w-[min(17rem,calc(100vw-2.5rem))] rounded-xl border border-[#EBEBEA] bg-white p-2 shadow-sm"
              >
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {COMPOSER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Insert ${emoji}`}
                      onClick={() => insertEmoji(emoji)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-[#F5F5F4]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 border-t border-[#F0F0EE] pt-1.5">
                  <button
                    type="button"
                    disabled={busy || isEditing}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-[#F5F5F4] disabled:opacity-40"
                    onClick={() => {
                      setEmojiOpen(false);
                      setGifOpen(false);
                      setStickerOpen(true);
                    }}
                  >
                    Stickers
                  </button>
                  <button
                    type="button"
                    disabled={busy || isEditing}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-[#F5F5F4] disabled:opacity-40"
                    onClick={() => {
                      setEmojiOpen(false);
                      setStickerOpen(false);
                      setGifOpen(true);
                    }}
                  >
                    GIF
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-[#F5F5F4] disabled:opacity-40"
                    onClick={() => {
                      setEmojiOpen(false);
                      insertAtMention();
                    }}
                  >
                    @ Mention
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative mb-0.5" ref={stickerRef}>
            {stickerOpen ? (
              <div
                role="dialog"
                aria-label="Sticker picker"
                className="absolute bottom-full left-0 z-10 mb-2 w-[min(16rem,calc(100vw-2.5rem))] rounded-xl border border-[#EBEBEA] bg-white p-2 shadow-sm"
              >
                <div className="grid grid-cols-4 gap-1">
                  {DISCUSSION_STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      aria-label={sticker.label}
                      title={sticker.label}
                      onClick={() => {
                        void sendSticker(sticker.emoji);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-lg text-2xl transition hover:bg-[#F5F5F4]"
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative mb-0.5" ref={gifRef}>
            {gifOpen ? (
              <div
                role="dialog"
                aria-label="GIF picker"
                className="absolute bottom-full left-0 z-10 mb-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-xl border border-[#EBEBEA] bg-white p-2 shadow-sm"
              >
                {gifsLoading ? (
                  <p className="px-1 py-3 text-center text-[12px] text-gray-500">
                    Loading GIFs…
                  </p>
                ) : (
                  <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
                    {gifs.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        aria-label="Send GIF"
                        onClick={() => {
                          void sendGif(gif);
                        }}
                        className="overflow-hidden rounded-lg bg-[#F5F5F4] transition hover:opacity-90"
                      >
                        <img
                          src={gif.previewUrl}
                          alt=""
                          className="aspect-square h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <textarea
            ref={textareaRef}
            id={`discussion-message-${scopeKey}`}
            rows={1}
            maxLength={MAX_CONTENT_LENGTH}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              requestAnimationFrame(() => {
                syncMentionFromCaret(event.target.value);
              });
            }}
            onKeyUp={() => syncMentionFromCaret()}
            onClick={() => syncMentionFromCaret()}
            onSelect={() => syncMentionFromCaret()}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={busy && !posting}
            placeholder={
              isEditing
                ? "Edit message…"
                : replyTo != null
                  ? "Write a reply…"
                  : dragOver
                    ? "Drop files to attach…"
                    : "Write a message…"
            }
            className="max-h-[120px] min-h-[30px] flex-1 resize-none border-0 bg-transparent py-1.5 text-[13.5px] leading-[1.35] text-foreground outline-none placeholder:text-gray-400 disabled:opacity-60"
          />
          {canSend ? (
            <button
              type="submit"
              aria-label={isEditing ? "Save edit" : "Send message"}
              className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
            >
              <AppIcon icon={isEditing ? Check : Send} size="sm" />
            </button>
          ) : null}
        </div>
          {!canSend ? (
            <button
              type="button"
              aria-label="Record voice message"
              title="Record voice message"
              disabled={!showMic}
              onClick={() => {
                void startVoiceRecording();
              }}
              className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#F0F0EE] hover:text-foreground disabled:opacity-40"
            >
              <AppIcon icon={Mic} size="sm" />
            </button>
          ) : null}
        </div>
      )}
      {trimmedLength > CHAR_COUNT_THRESHOLD ? (
        <p className="mt-1 text-right text-xs text-label">
          {trimmedLength}/{MAX_CONTENT_LENGTH}
        </p>
      ) : null}
    </form>
  );
}

function PinnedMessageBar({
  pinned,
  onJump,
  onUnpin,
  canUnpin,
}: {
  pinned: DiscussionPinnedMessage;
  onJump: () => void;
  onUnpin?: () => void;
  canUnpin: boolean;
}) {
  const preview = pinned.message.is_deleted
    ? "This message was deleted"
    : snippetText(pinned.message.content, 72);

  return (
    <div className="shrink-0 border-b border-[#F0F0EE] bg-white px-3 py-1 sm:px-4">
      <div className="discussion-msg-column flex items-center gap-2">
        <button
          type="button"
          onClick={onJump}
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left transition hover:opacity-80"
        >
          <AppIcon icon={Pin} size="xs" className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[12px] text-gray-600">
            <span className="font-medium text-[#202020]">{preview}</span>
          </span>
          <span className="shrink-0 text-[11px] font-medium text-primary">
            View
          </span>
        </button>
        {canUnpin && onUnpin ? (
          <button
            type="button"
            aria-label="Unpin message"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-[#F5F5F4] hover:text-foreground"
            onClick={onUnpin}
          >
            <AppIcon icon={X} size="xs" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DiscussionShell({
  title,
  description,
  descriptionLines,
  introCreatedLabel,
  introVisibilityLabel,
  className,
  variant,
  onBack,
  headerAction,
  scopeKey,
  messages,
  loading,
  loadingOlder = false,
  loadError,
  emptyLabel,
  draft,
  setDraft,
  posting,
  errorMessage,
  onSend,
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
  firstUnreadMessageId = null,
  onAuthorClick,
  onDeleteMessage,
  onReplyMessage,
  onEditMessage,
  onPinMessage,
  onForwardMessage,
  pinnedMessage = null,
  onUnpinMessage,
  onJumpToPinned,
  replyTo = null,
  onCancelReply,
  editingMessage = null,
  onCancelEdit,
  eventContextId,
  forwardingHint = false,
}: {
  title: string;
  description?: string;
  descriptionLines?: string[];
  introCreatedLabel?: string;
  introVisibilityLabel?: string;
  className: string;
  variant: "pane" | "card";
  onBack?: () => void;
  headerAction?: ReactNode;
  scopeKey: string;
  messages: DiscussionMessage[];
  loading: boolean;
  loadingOlder?: boolean;
  loadError: string | null;
  emptyLabel: string;
  draft: string;
  setDraft: (value: string) => void;
  posting: boolean;
  errorMessage: string | null;
  onSend: (payload: {
    content: string;
    attachments?: DiscussionAttachmentUpload[];
  }) => void | Promise<void>;
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
  firstUnreadMessageId?: number | null;
  onAuthorClick?: (author: DiscussionMessageAuthor) => void;
  onDeleteMessage?: (messageId: number) => void;
  onReplyMessage?: (message: DiscussionMessage) => void;
  onEditMessage?: (message: DiscussionMessage) => void;
  onPinMessage?: (messageId: number) => void;
  onForwardMessage?: (message: DiscussionMessage) => void;
  pinnedMessage?: DiscussionPinnedMessage | null;
  onUnpinMessage?: () => void;
  onJumpToPinned?: () => void;
  replyTo?: DiscussionMessage | null;
  onCancelReply?: () => void;
  editingMessage?: DiscussionMessage | null;
  onCancelEdit?: () => void;
  eventContextId?: number | null;
  forwardingHint?: boolean;
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPane = variant === "pane";
  const [longPressedMessageId, setLongPressedMessageId] = useState<
    number | null
  >(null);
  const [messageQuery, setMessageQuery] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const subtitleLines =
    descriptionLines?.filter(Boolean) ??
    (description ? [description] : []);

  const filteredMessages = messageQuery.trim()
    ? messages.filter((message) =>
        message.content
          .toLowerCase()
          .includes(messageQuery.trim().toLowerCase()),
      )
    : messages;

  const timeline = buildDiscussionTimeline(filteredMessages, viewerUserId, {
    firstUnreadMessageId: firstUnreadMessageId ?? null,
  });
  const virtualizeTimeline = timeline.length >= VIRTUALIZE_TIMELINE_AFTER;

  // Fingerprint content that affects row height (reactions, edits, attachments).
  const timelineMeasureKey = messages
    .map((message) => {
      const reactionKey = Object.entries(message.reactions ?? {})
        .map(([emoji, summary]) => `${emoji}:${summary.count}`)
        .sort()
        .join(",");
      return `${message.id}:${message.edited_at ?? ""}:${message.is_deleted ? 1 : 0}:${message.attachments?.length ?? 0}:${reactionKey}`;
    })
    .join("|");

  const virtualizer = useVirtualizer({
    count: virtualizeTimeline ? timeline.length : 0,
    getScrollElement: () => listRef?.current ?? null,
    // Stable keys prevent day/unread rows from reusing a tall message's cached size
    // (index-keyed cache is what produced the huge wallpaper gaps between chats).
    getItemKey: (index) => timeline[index]?.key ?? index,
    estimateSize: (index) => {
      const item = timeline[index];
      if (item?.kind === "day" || item?.kind === "unread") {
        return 36;
      }
      if (item?.kind === "group") {
        const nameH = item.isOwn ? 0 : 18;
        return nameH + item.messages.length * 44 + 8;
      }
      return 44;
    },
    overscan: 12,
    gap: 4,
  });

  useLayoutEffect(() => {
    if (!virtualizeTimeline) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      virtualizer.measure();
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure on content/height-affecting changes only
  }, [virtualizeTimeline, timeline.length, timelineMeasureKey]);

  useEffect(() => {
    deepLinkHandledRef.current = null;
  }, [scopeKey]);

  useEffect(() => {
    if (loading || messages.length === 0) {
      return;
    }
    const raw = searchParams.get("msg");
    if (!raw) {
      return;
    }
    const messageId = Number(raw);
    if (!Number.isFinite(messageId)) {
      return;
    }
    const handleKey = `${scopeKey}:${messageId}`;
    if (deepLinkHandledRef.current === handleKey) {
      return;
    }
    if (!messages.some((message) => message.id === messageId)) {
      return;
    }
    deepLinkHandledRef.current = handleKey;
    window.setTimeout(() => {
      const el = document.getElementById(`discussion-msg-${messageId}`);
      if (typeof el?.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  }, [loading, messages, searchParams, scopeKey]);

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

  function handleCopyMessageLink(messageId: number) {
    const url = messagePermalink(location.pathname, messageId);
    void navigator.clipboard?.writeText(url);
  }

  const messageGroupProps: MessageGroupSharedProps = {
    onToggleReaction,
    reactionsDisabled,
    seenIndicator,
    longPressedMessageId,
    onDismissForceShow: () => setLongPressedMessageId(null),
    onMessageTouchStart: handleMessageTouchStart,
    onMessageTouchEnd: handleMessageTouchEnd,
    onMessageContextMenu: (messageId, event) => {
      if (!onToggleReaction) {
        return;
      }
      event.preventDefault();
      setLongPressedMessageId(messageId);
    },
    onAuthorClick,
    onDeleteMessage,
    onReplyMessage,
    onEditMessage,
    onPinMessage,
    onForwardMessage,
    onCopyMessageLink: handleCopyMessageLink,
    viewerUserId,
    pinnedMessageId: pinnedMessage?.message.id ?? null,
  };

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  useEffect(() => {
    if (!isPane) {
      return;
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMessageSearchOpen(true);
      }
      if (event.key === "Escape") {
        setMessageSearchOpen(false);
        setMessageQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPane]);

  useEffect(() => {
    if (messageSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [messageSearchOpen]);

  const headerIcon =
    scopeKey === "board"
      ? Megaphone
      : scopeKey.startsWith("event:")
        ? CalendarDays
        : scopeKey.startsWith("room:")
          ? Users
          : MessagesSquare;

  const header = (
    <div className="shrink-0 border-b border-[#EFEFEF] bg-white">
      <div className="flex min-h-14 items-center gap-3 px-3 py-2 sm:px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to rooms"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-[#F5F5F4] md:hidden"
          >
            <AppIcon icon={ArrowLeft} size="sm" />
          </button>
        ) : null}
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0F0EE] text-gray-600"
          aria-hidden="true"
        >
          <AppIcon icon={headerIcon} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] leading-[1.35] text-gray-500">
            {subtitleLines.map((line, index) => (
              <span key={line} className="inline-flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <span className="text-gray-300" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                <span className="truncate">{line}</span>
              </span>
            ))}
            {statusBadge}
            {presence}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Search messages"
            aria-keyshortcuts="Meta+K"
            aria-pressed={messageSearchOpen}
            title="Search messages (⌘K)"
            onClick={() => setMessageSearchOpen((open) => !open)}
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#F5F5F4] hover:text-foreground",
              messageSearchOpen ? "bg-[#F5F5F4] text-foreground" : "",
            ].join(" ")}
          >
            <AppIcon icon={Search} size="sm" />
          </button>
          {headerAction}
        </div>
      </div>
      {messageSearchOpen ? (
        <div className="px-3 pb-2.5 sm:px-5">
          <label className="relative block max-w-lg">
            <span className="sr-only">Search messages</span>
            <AppIcon
              icon={Search}
              size="xs"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={messageQuery}
              onChange={(event) => setMessageQuery(event.target.value)}
              placeholder="Search messages…"
              className="w-full rounded-md border-0 bg-[#F5F5F4] py-1.5 pl-8 pr-16 text-[13px] text-foreground outline-none placeholder:text-gray-400"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#E4E4E3] bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              ⌘K
            </kbd>
          </label>
        </div>
      ) : null}
    </div>
  );

  const body = (
    <>
      {header}
      {eventContextId != null ? (
        <EventContextStrip eventId={eventContextId} />
      ) : null}
      {pinnedMessage ? (
        <PinnedMessageBar
          pinned={pinnedMessage}
          onJump={() => onJumpToPinned?.()}
          onUnpin={onUnpinMessage}
          canUnpin={!reactionsDisabled}
        />
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={() => {
            onListScroll?.();
            const el = listRef?.current;
            if (!el) {
              return;
            }
            const distance =
              el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowJumpLatest(distance > 140);
          }}
          className={[
            "discussion-msg-scroller h-full min-h-0 overflow-y-auto overscroll-y-contain px-3 py-2 sm:px-5",
            isPane ? "" : "max-h-96 min-h-48",
          ].join(" ")}
        >
          <div className="discussion-msg-column flex min-h-full flex-col">
          <div className="mt-auto w-full">
          {loading ? (
            <p className="text-sm text-label">Loading discussion…</p>
          ) : null}

          {loadError ? (
            <p className="text-sm text-overdue" role="alert">
              {loadError}
            </p>
          ) : null}

          {!loading && !loadError && messages.length === 0 ? (
            <DiscussionIntro
              title={title}
              createdLabel={introCreatedLabel}
              visibilityLabel={introVisibilityLabel ?? emptyLabel}
            />
          ) : null}

          {!loading &&
          !loadError &&
          messages.length > 0 &&
          messageQuery.trim() &&
          timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-label">
              No messages match “{messageQuery.trim()}”.
            </p>
          ) : null}

          <div className="relative">
            {loadingOlder ? (
              <p className="py-1 text-center text-[11px] text-label">
                Loading earlier messages…
              </p>
            ) : null}
            {virtualizeTimeline ? (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = timeline[virtualRow.index];
                  if (!item) {
                    return null;
                  }
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {item.kind === "day" ? (
                        <DaySeparator label={item.label} />
                      ) : item.kind === "unread" ? (
                        <UnreadSeparator />
                      ) : (
                        <MessageGroup
                          author={item.author}
                          isOwn={item.isOwn}
                          messages={item.messages}
                          {...messageGroupProps}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {timeline.map((item) => (
                  <div key={item.key}>
                    {item.kind === "day" ? (
                      <DaySeparator label={item.label} />
                    ) : item.kind === "unread" ? (
                      <UnreadSeparator />
                    ) : (
                      <MessageGroup
                        author={item.author}
                        isOwn={item.isOwn}
                        messages={item.messages}
                        {...messageGroupProps}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {typing}
          <div ref={bottomRef} />
          </div>
          </div>
        </div>
        {showJumpLatest ? (
          <button
            type="button"
            aria-label="Jump to latest messages"
            className="absolute bottom-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EBEBEA] bg-white text-gray-600 shadow-sm transition hover:bg-[#F5F5F4] hover:text-foreground"
            onClick={() => {
              if (typeof bottomRef.current?.scrollIntoView === "function") {
                bottomRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }
              setShowJumpLatest(false);
            }}
          >
            <AppIcon icon={ChevronDown} size="sm" />
          </button>
        ) : null}
      </div>

      <Composer
        scopeKey={scopeKey}
        draft={draft}
        setDraft={setDraft}
        posting={posting}
        sendDisabled={sendDisabled}
        errorMessage={errorMessage}
        onSend={onSend}
        replyTo={replyTo}
        onCancelReply={onCancelReply}
        editingMessage={editingMessage}
        onCancelEdit={onCancelEdit}
        forwardingHint={forwardingHint}
      />
    </>
  );


  if (isPane) {
    return (
      <section
        className={[
          "discussion-feed-pane flex h-full min-h-0 flex-col bg-white",
          className,
        ]
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
  descriptionLines,
  introCreatedLabel,
  introVisibilityLabel,
  emptyLabel,
  className,
  scope,
  variant,
  onBack,
  headerAction,
}: {
  title: string;
  description?: string;
  descriptionLines?: string[];
  introCreatedLabel?: string;
  introVisibilityLabel?: string;
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
    pinnedMessage,
    typingUsers,
    seenIndicator,
    status,
    error,
    loading,
    hasMoreOlder,
    loadingOlder,
    firstUnreadMessageId,
    loadOlderMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    toggleReaction,
    markLatestAsRead,
    notifyTypingActivity,
  } = useDiscussion(scope, { viewerUserId: member?.id ?? null });
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DiscussionMessage | null>(null);
  const [editingMessage, setEditingMessage] =
    useState<DiscussionMessage | null>(null);
  const [forwardingHint, setForwardingHint] = useState(false);
  const [forwardMessage, setForwardMessage] =
    useState<DiscussionMessage | null>(null);
  const [profileMember, setProfileMember] = useState<MemberResponse | null>(
    null,
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const loadOlderDebounceRef = useRef<number | null>(null);
  const prevMessageCountRef = useRef(0);
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
    // Avoid jumping to bottom when older history is prepended.
    if (pendingScrollRestoreRef.current != null) {
      return;
    }
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    markLatestAsRead();
  }, [messages.length, othersTyping.length, markLatestAsRead]);

  useLayoutEffect(() => {
    const prevHeight = pendingScrollRestoreRef.current;
    const el = listRef.current;
    if (prevHeight == null || !el) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length <= prevMessageCountRef.current) {
      if (!loadingOlder) {
        pendingScrollRestoreRef.current = null;
      }
      return;
    }
    el.scrollTop = el.scrollHeight - prevHeight;
    pendingScrollRestoreRef.current = null;
    prevMessageCountRef.current = messages.length;
  }, [messages, loadingOlder]);

  useEffect(() => {
    return () => {
      if (loadOlderDebounceRef.current != null) {
        window.clearTimeout(loadOlderDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setDraft("");
    setErrorMessage(null);
    setReplyTo(null);
    setEditingMessage(null);
    setForwardingHint(false);
    pendingScrollRestoreRef.current = null;
    prevMessageCountRef.current = 0;
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

    if (
      el.scrollTop < LOAD_OLDER_TOP_PX &&
      hasMoreOlder &&
      !loadingOlder &&
      status === "live"
    ) {
      if (loadOlderDebounceRef.current != null) {
        window.clearTimeout(loadOlderDebounceRef.current);
      }
      loadOlderDebounceRef.current = window.setTimeout(() => {
        loadOlderDebounceRef.current = null;
        const scroller = listRef.current;
        if (!scroller || scroller.scrollTop >= LOAD_OLDER_TOP_PX) {
          return;
        }
        pendingScrollRestoreRef.current = scroller.scrollHeight;
        prevMessageCountRef.current = messages.length;
        loadOlderMessages();
      }, LOAD_OLDER_DEBOUNCE_MS);
    }
  }

  function clearComposerModes() {
    setReplyTo(null);
    setEditingMessage(null);
  }

  function handleReply(message: DiscussionMessage) {
    setEditingMessage(null);
    setForwardingHint(false);
    setReplyTo(message);
  }

  function handleEdit(message: DiscussionMessage) {
    setReplyTo(null);
    setForwardingHint(false);
    setEditingMessage(message);
    setDraft(message.content);
  }

  function handleForward(message: DiscussionMessage) {
    clearComposerModes();
    setForwardingHint(false);
    setForwardMessage(message);
  }

  function jumpToPinned() {
    const messageId = pinnedMessage?.message.id;
    if (messageId == null) {
      return;
    }
    const el = document.getElementById(`discussion-msg-${messageId}`);
    if (typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function handleSend(payload: {
    content: string;
    attachments?: DiscussionAttachmentUpload[];
  }) {
    const content = payload.content.trim();
    const attachments = payload.attachments ?? [];
    if (
      (!content && attachments.length === 0) ||
      posting ||
      status !== "live"
    ) {
      return;
    }

    setPosting(true);
    setErrorMessage(null);

    try {
      if (editingMessage != null) {
        if (!content) {
          throw new Error("Message content is required");
        }
        editMessage(editingMessage.id, content);
        setDraft("");
        clearComposerModes();
        setForwardingHint(false);
      } else {
        sendMessage(content, {
          replyToMessageId: replyTo?.id ?? null,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        setDraft("");
        setReplyTo(null);
        setForwardingHint(false);
        nearBottomRef.current = true;
        markLatestAsRead();
      }
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : editingMessage != null
            ? "Failed to edit message"
            : "Failed to send message",
      );
      throw caught;
    } finally {
      setPosting(false);
    }
  }

  async function handleAuthorClick(author: DiscussionMessageAuthor) {
    if (profileLoading) {
      return;
    }
    setProfileLoading(true);
    try {
      const detail = await fetchMemberById(author.id);
      setProfileMember(detail);
      setProfileOpen(true);
    } catch (caught) {
      window.alert(getApiErrorMessage(caught));
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <>
      <DiscussionShell
        title={title}
        description={description}
        descriptionLines={descriptionLines}
        introCreatedLabel={introCreatedLabel}
        introVisibilityLabel={introVisibilityLabel}
        className={className}
        variant={variant}
        onBack={onBack}
        headerAction={headerAction}
        scopeKey={scopeKey}
        messages={messages}
        loading={loading}
        loadingOlder={loadingOlder}
        loadError={error}
        emptyLabel={emptyLabel}
        draft={draft}
        setDraft={(value) => {
          setDraft(value);
          if (value.trim() && editingMessage == null) {
            notifyTypingActivity();
          }
        }}
        posting={posting}
        errorMessage={errorMessage}
        onSend={handleSend}
        bottomRef={bottomRef}
        listRef={listRef}
        onListScroll={handleListScroll}
        statusBadge={
          status === "live" ? null : (
            <ConnectionStatusBadge status={status} />
          )
        }
        typing={<TypingIndicator users={othersTyping} />}
        sendDisabled={status !== "live"}
        onToggleReaction={toggleReaction}
        reactionsDisabled={status !== "live"}
        seenIndicator={seenIndicator}
        viewerUserId={member?.id ?? null}
        firstUnreadMessageId={firstUnreadMessageId}
        onAuthorClick={(author) => {
          void handleAuthorClick(author);
        }}
        onDeleteMessage={(messageId) => {
          try {
            deleteMessage(messageId);
            if (editingMessage?.id === messageId) {
              setDraft("");
              setEditingMessage(null);
            }
            if (replyTo?.id === messageId) {
              setReplyTo(null);
            }
          } catch (caught) {
            setErrorMessage(
              caught instanceof Error
                ? caught.message
                : "Could not delete message",
            );
          }
        }}
        onReplyMessage={handleReply}
        onEditMessage={handleEdit}
        onForwardMessage={handleForward}
        onPinMessage={(messageId) => {
          try {
            pinMessage(messageId);
          } catch (caught) {
            setErrorMessage(
              caught instanceof Error
                ? caught.message
                : "Could not pin message",
            );
          }
        }}
        pinnedMessage={pinnedMessage}
        onUnpinMessage={() => {
          try {
            unpinMessage();
          } catch (caught) {
            setErrorMessage(
              caught instanceof Error
                ? caught.message
                : "Could not unpin message",
            );
          }
        }}
        onJumpToPinned={jumpToPinned}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => {
          setEditingMessage(null);
          setDraft("");
        }}
        eventContextId={scope.type === "event" ? scope.eventId : null}
        forwardingHint={forwardingHint}
      />
      <ForwardMessageModal
        open={forwardMessage != null}
        message={forwardMessage}
        currentRoomId={scopeKey}
        onClose={() => setForwardMessage(null)}
      />
      <MemberQuickViewDrawer
        member={profileMember}
        open={profileOpen && profileMember != null}
        onClose={() => {
          setProfileOpen(false);
        }}
      />
    </>
  );
}

export function DiscussionFeed({
  title,
  description,
  descriptionLines,
  introCreatedLabel,
  introVisibilityLabel,
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
      descriptionLines={descriptionLines}
      introCreatedLabel={introCreatedLabel}
      introVisibilityLabel={introVisibilityLabel}
      emptyLabel={emptyLabel}
      className={className}
      scope={scope}
      variant={variant}
      onBack={onBack}
      headerAction={headerAction}
    />
  );
}
