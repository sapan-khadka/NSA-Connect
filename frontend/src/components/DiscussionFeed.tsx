import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { Avatar } from "../design-system/components/Avatar";
import { useAuth } from "../context/useAuth";
import type { DiscussionMessage } from "../lib/discussion-api";
import {
  useDiscussion,
  type DiscussionPresenceUser,
  type DiscussionStatus,
} from "../lib/useEventDiscussion";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { formatRelativeTimestamp } from "../lib/format-datetime";

const MAX_CONTENT_LENGTH = 2000;
const MAX_VISIBLE_AVATARS = 4;

type DiscussionFeedProps = {
  title: string;
  description?: string;
  emptyLabel?: string;
  scope: { type: "event"; eventId: number } | { type: "board" };
  className?: string;
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
            className="ring-2 ring-surface-card"
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

function TypingIndicator({
  users,
}: {
  users: DiscussionPresenceUser[];
}) {
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
    <p className="mt-2 text-xs text-label" role="status" aria-live="polite">
      {label}
    </p>
  );
}

function LiveDiscussionFeed({
  title,
  description,
  emptyLabel,
  className,
  scope,
}: {
  title: string;
  description?: string;
  emptyLabel: string;
  className: string;
  scope: DiscussionFeedProps["scope"];
}) {
  const {
    messages,
    presentUsers,
    typingUsers,
    status,
    error,
    loading,
    sendMessage,
    notifyTypingActivity,
  } = useDiscussion(scope);
  const { member } = useAuth();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scopeKey =
    scope.type === "board" ? "board" : `event:${scope.eventId}`;
  const othersTyping = typingUsers.filter(
    (user) => user.user_id !== member?.id,
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, othersTyping.length]);

  useEffect(() => {
    setDraft("");
    setErrorMessage(null);
  }, [scopeKey]);

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
      statusBadge={<ConnectionStatusBadge status={status} />}
      presence={<PresenceAvatarStack users={presentUsers} />}
      typing={<TypingIndicator users={othersTyping} />}
      sendDisabled={status !== "live"}
    />
  );
}

function DiscussionShell({
  title,
  description,
  className,
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
  statusBadge,
  presence,
  typing,
  sendDisabled = false,
}: {
  title: string;
  description?: string;
  className: string;
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
  statusBadge?: ReactNode;
  presence?: ReactNode;
  typing?: ReactNode;
  sendDisabled?: boolean;
}) {
  return (
    <Card
      padding="none"
      className={["flex flex-col overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <div className="border-b border-gray-200 px-4 py-3 lg:px-5 lg:py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="text-base font-medium text-foreground">{title}</h2>
            {presence}
          </div>
          {statusBadge}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-label">{description}</p>
        ) : null}
      </div>

      <div className="max-h-80 min-h-48 overflow-y-auto overscroll-y-contain px-4 py-3 lg:max-h-96 lg:px-5">
        {loading ? (
          <p className="text-sm text-label">Loading discussion…</p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-overdue" role="alert">
            {loadError}
          </p>
        ) : null}

        {!loading && !loadError && messages.length === 0 ? (
          <p className="text-sm text-label">{emptyLabel}</p>
        ) : null}

        <ul className="space-y-4">
          {messages.map((message) => (
            <li key={message.id} className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {message.author.full_name}
                </span>
                <time
                  dateTime={message.created_at}
                  className="text-xs text-label"
                  title={new Date(message.created_at).toLocaleString()}
                >
                  {formatRelativeTimestamp(message.created_at)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {message.content}
              </p>
            </li>
          ))}
        </ul>
        {typing}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-gray-200 px-4 py-3 lg:px-5"
      >
        {errorMessage ? (
          <p className="mb-2 text-sm text-overdue" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <label className="sr-only" htmlFor={`discussion-message-${scopeKey}`}>
          Message
        </label>
        <textarea
          id={`discussion-message-${scopeKey}`}
          rows={2}
          maxLength={MAX_CONTENT_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message…"
          className="w-full rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-label">
            {draft.trim().length}/{MAX_CONTENT_LENGTH}
          </p>
          <Button
            type="submit"
            disabled={posting || sendDisabled || !draft.trim()}
            loading={posting}
          >
            Post
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function DiscussionFeed({
  title,
  description,
  emptyLabel = "No messages yet. Start the conversation.",
  scope,
  className = "",
}: DiscussionFeedProps) {
  return (
    <LiveDiscussionFeed
      title={title}
      description={description}
      emptyLabel={emptyLabel}
      className={className}
      scope={scope}
    />
  );
}
