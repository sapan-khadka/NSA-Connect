import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  streamChatMessage,
  type ChatHistoryMessage,
} from "../../lib/chat-stream";
import { getApiErrorMessage } from "../../lib/auth-api";
import { ChatMessageBubble, type ChatMessage } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";

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

function statusLabelForPhase(phase: string): string {
  switch (phase) {
    case "retrieving":
      return "Searching the constitution…";
    case "tools":
      return "Checking live NSA Connect data…";
    case "thinking":
      return "Drafting a response…";
    default:
      return "Assistant is typing…";
  }
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createMessageId(),
      role: "assistant",
      content:
        "Hi! I can answer constitution questions and look up live NSA Connect data about events, members, and finances.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    try {
      await streamChatMessage(
        {
          message: trimmed,
          history,
        },
        {
          onStatus: (phase) => {
            setStatusLabel(statusLabelForPhase(phase));
          },
          onToken: (text) => {
            setStatusLabel(null);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: message.content + text }
                  : message,
              ),
            );
          },
          onMetadata: (metadata) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      constitutionSources: metadata.constitution_sources,
                    }
                  : message,
              ),
            );
          },
          onError: (message) => {
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
      setIsStreaming(false);
      setStatusLabel(null);
      abortRef.current = null;
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, isStreaming: false }
            : message,
        ),
      );
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
    <section className="flex h-[min(72vh,720px)] flex-col overflow-hidden ds-card">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
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
        className="border-t border-gray-200 bg-white px-4 py-4 sm:px-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="assistant-message" className="sr-only">
            Message the AI assistant
          </label>
          <textarea
            id="assistant-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="Ask about the constitution, upcoming events, or prep tasks…"
            disabled={isStreaming}
            className="min-h-[3rem] flex-1 resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5 sm:self-end"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={draft.trim().length === 0}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
