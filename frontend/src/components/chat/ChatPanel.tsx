import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";

import {
  streamChatMessage,
  type ChatHistoryMessage,
} from "../../lib/chat-stream";
import { isTreasurySummary } from "../../lib/treasury-summary";
import { getApiErrorMessage } from "../../lib/api-error";
import type { MemberResponse } from "../../lib/auth-api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ChatMessageBubble, type ChatMessage } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { useAuth } from "../../context/useAuth";

function createMessageId(): string {
  return crypto.randomUUID();
}

function toHistory(messages: ChatMessage[]): ChatHistoryMessage[] {
  return messages
    .filter((message) => !message.isStreaming && message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function greetingMessage(): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    content:
      "Hi! I can look up live NSA Connect data: members, dues, events, tasks, and finance. I can also search the constitution and chapter documents the board uploads.",
  };
}

function chatSessionKey(
  member: MemberResponse | null,
  isAuthenticated: boolean,
): string {
  if (!isAuthenticated || member == null) {
    return "signed-out";
  }
  return [
    member.id,
    member.organization?.id ?? "none",
    member.role,
    member.position,
    member.is_org_owner ? "owner" : "member",
  ].join(":");
}
function statusLabelForPhase(phase: string): string {
  switch (phase) {
    case "retrieving":
      return "Searching constitution and documents…";
    case "tools":
      return "Checking live NSA Connect data…";
    case "thinking":
      return "Drafting a response…";
    default:
      return "Assistant is typing…";
  }
}

export function ChatPanel({
  starterQuery = null,
}: {
  starterQuery?: string | null;
}) {
  const { member, isAuthenticated } = useAuth();
  const sessionKey = chatSessionKey(member, isAuthenticated);
  const sessionKeyRef = useRef(sessionKey);
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingMessage()]);
  const [draft, setDraft] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (starterQuery?.trim()) {
      setDraft(starterQuery.trim());
    }
  }, [starterQuery]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, statusLabel, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (sessionKeyRef.current === sessionKey) {
      return;
    }
    sessionKeyRef.current = sessionKey;
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([greetingMessage()]);
    setDraft("");
    setError(null);
    setIsStreaming(false);
    setStatusLabel(null);
  }, [sessionKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    setError(null);
    setDraft("");

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
    };
    const assistantMessageId = createMessageId();
    const history = toHistory(messages);

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        isStreaming: true,
      },
    ]);
    setIsStreaming(true);
    setStatusLabel("Assistant is typing…");

    const controller = new AbortController();
    abortRef.current = controller;
    const requestSession = sessionKeyRef.current;

    try {
      await streamChatMessage(
        {
          message: trimmed,
          history,
        },
        {
          onStatus: (phase) => {
            if (sessionKeyRef.current !== requestSession) {
              return;
            }
            setStatusLabel(statusLabelForPhase(phase));
          },
          onToken: (text) => {
            if (
              sessionKeyRef.current !== requestSession ||
              controller.signal.aborted
            ) {
              return;
            }
            setStatusLabel(null);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: message.content + text }
                  : message,
              ),
            );
          },
          onResetText: () => {
            if (
              sessionKeyRef.current !== requestSession ||
              controller.signal.aborted
            ) {
              return;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: "", financeSummary: null }
                  : message,
              ),
            );
          },
          onFinanceSummary: (summary) => {
            if (
              sessionKeyRef.current !== requestSession ||
              controller.signal.aborted
            ) {
              return;
            }
            if (!isTreasurySummary(summary)) {
              return;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, financeSummary: summary }
                  : message,
              ),
            );
          },
          onMetadata: (metadata) => {
            if (
              sessionKeyRef.current !== requestSession ||
              controller.signal.aborted
            ) {
              return;
            }
            const financeSummary = isTreasurySummary(metadata.finance_summary)
              ? metadata.finance_summary
              : null;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      constitutionSources: metadata.constitution_sources,
                      financeSummary,
                    }
                  : message,
              ),
            );
          },
          onError: (message) => {
            if (sessionKeyRef.current !== requestSession) {
              return;
            }
            setError(message);
            setMessages((current) =>
              current.filter(
                (entry) =>
                  entry.id !== assistantMessageId ||
                  entry.content.trim().length > 0,
              ),
            );
          },
        },
        controller.signal,
      );
    } catch (caughtError) {
      const wasAborted =
        controller.signal.aborted ||
        (caughtError instanceof DOMException &&
          caughtError.name === "AbortError");

      if (sessionKeyRef.current !== requestSession) {
        return;
      }

      if (wasAborted) {
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== assistantMessageId ||
              message.content.trim().length > 0,
          ),
        );
      } else {
        setError(getApiErrorMessage(caughtError));
        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessageId),
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (sessionKeyRef.current === requestSession) {
        setIsStreaming(false);
        setStatusLabel(null);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, isStreaming: false }
              : message,
          ),
        );
      }
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const showTypingIndicator =
    isStreaming &&
    messages.some(
      (message) => message.isStreaming && message.content.trim().length === 0,
    );

  return (
    <Card
      padding="none"
      className="flex h-[min(58dvh,720px)] min-w-0 max-w-full flex-col overflow-hidden sm:h-[min(72vh,720px)]"
    >
      <div
        ref={scrollRef}
        className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6"
        aria-live="polite"
      >
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}

        {showTypingIndicator ? (
          <TypingIndicator label={statusLabel ?? "Assistant is typing…"} />
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="border-t border-gray-200 bg-surface-card px-4 py-2 text-sm text-foreground sm:px-6"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="min-w-0 border-t border-gray-200 bg-white px-4 py-4 sm:px-6"
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          <label htmlFor="assistant-message" className="sr-only">
            Message the AI assistant
          </label>
          <textarea
            id="assistant-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="Ask about members, dues, events, constitution, or chapter docs…"
            disabled={isStreaming}
            className="min-h-[3rem] w-full min-w-0 flex-1 resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5 sm:w-auto sm:self-end"
            >
              Stop
            </button>
          ) : (
            <Button
              type="submit"
              disabled={draft.trim().length === 0}
              className="w-full sm:w-auto sm:self-end"
            >
              Send
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
