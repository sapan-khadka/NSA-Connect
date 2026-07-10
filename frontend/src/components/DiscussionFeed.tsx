import { useEffect, useRef, useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchBoardDiscussion,
  fetchEventDiscussion,
  postBoardDiscussion,
  postEventDiscussion,
  type DiscussionMessage,
} from "../lib/discussion-api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { formatRelativeTimestamp } from "../lib/format-datetime";

const POLL_INTERVAL_MS = 20_000;
const MAX_CONTENT_LENGTH = 2000;

type DiscussionFeedProps = {
  title: string;
  description?: string;
  emptyLabel?: string;
  scope: { type: "event"; eventId: number } | { type: "board" };
  className?: string;
};

function mergeMessages(
  current: DiscussionMessage[],
  incoming: DiscussionMessage[],
): DiscussionMessage[] {
  if (incoming.length === 0) {
    return current;
  }
  const knownIds = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !knownIds.has(message.id));
  if (fresh.length === 0) {
    return current;
  }
  return [...current, ...fresh];
}

export function DiscussionFeed({
  title,
  description,
  emptyLabel = "No messages yet. Start the conversation.",
  scope,
  className = "",
}: DiscussionFeedProps) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestIdRef = useRef<number | null>(null);
  const eventId = scope.type === "event" ? scope.eventId : null;
  const scopeKey = scope.type === "event" ? `event:${scope.eventId}` : "board";

  useEffect(() => {
    let cancelled = false;
    latestIdRef.current = null;
    setMessages([]);
    setDraft("");
    setErrorMessage(null);

    async function loadInitial() {
      setLoading(true);
      setLoadError(null);
      try {
        const response =
          eventId == null
            ? await fetchBoardDiscussion()
            : await fetchEventDiscussion(eventId);
        if (cancelled) {
          return;
        }
        setMessages(response.messages);
        latestIdRef.current =
          response.messages.at(-1)?.id ?? null;
      } catch (error) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [eventId, scopeKey]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const afterId = latestIdRef.current;
        const response =
          eventId == null
            ? await fetchBoardDiscussion(
                afterId != null ? { afterId } : undefined,
              )
            : await fetchEventDiscussion(
                eventId,
                afterId != null ? { afterId } : undefined,
              );

        if (cancelled || response.messages.length === 0) {
          return;
        }

        if (afterId == null) {
          setMessages(response.messages);
          latestIdRef.current = response.messages.at(-1)?.id ?? null;
          return;
        }

        setMessages((current) => {
          const next = mergeMessages(current, response.messages);
          latestIdRef.current = next.at(-1)?.id ?? latestIdRef.current;
          return next;
        });
      } catch {
        // Keep the open feed usable if a poll fails.
      }
    }

    const timerId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [eventId, scopeKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting) {
      return;
    }

    setPosting(true);
    setErrorMessage(null);

    try {
      const created =
        eventId == null
          ? await postBoardDiscussion(content)
          : await postEventDiscussion(eventId, content);
      setMessages((current) => {
        const next = mergeMessages(current, [created]);
        latestIdRef.current = next.at(-1)?.id ?? created.id;
        return next;
      });
      setDraft("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card
      padding="none"
      className={["flex flex-col overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <div className="border-b border-gray-200 px-4 py-3 lg:px-5 lg:py-4">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
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
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
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
            disabled={posting || !draft.trim()}
            loading={posting}
          >
            Post
          </Button>
        </div>
      </form>
    </Card>
  );
}
