import type {
  ChatConstitutionSource,
  ChatFinanceSummary,
} from "../../lib/chat-stream";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { TreasurySummaryCard } from "./TreasurySummaryCard";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  statusLabel?: string;
  constitutionSources?: ChatConstitutionSource[];
  financeSummary?: ChatFinanceSummary | null;
};

type ChatMessageBubbleProps = {
  message: ChatMessage;
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article
      className={[
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "min-w-0 max-w-full overflow-hidden rounded-2xl px-3 py-3 text-sm leading-6 shadow-sm sm:max-w-[85%] sm:px-4",
          isUser
            ? "rounded-br-md bg-foreground text-white"
            : "rounded-bl-md border border-gray-200 bg-white text-foreground",
        ].join(" ")}
      >
        {message.statusLabel && !message.content ? (
          <p className="text-label">{message.statusLabel}</p>
        ) : isUser ? (
          <p className="select-text whitespace-pre-wrap break-words">
            {message.content || " "}
          </p>
        ) : (
          <div className="min-w-0 select-text">
            {message.content ? <AssistantMarkdown content={message.content} /> : null}
            {message.isStreaming ? (
              <span
                aria-hidden="true"
                data-testid="streaming-cursor"
                className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-current align-baseline"
              />
            ) : null}
          </div>
        )}

        {!isUser && message.constitutionSources && message.constitutionSources.length > 0 ? (
          <details className="mt-3 border-t border-gray-100 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-label">
              Retrieved excerpts ({message.constitutionSources.length})
            </summary>
            <p className="mt-2 text-[11px] leading-4 text-label">
              Retrieved context from the constitution, not independently verified citations.
            </p>
            <ul className="mt-2 space-y-2">
              {message.constitutionSources.map((source) => (
                <li
                  key={source.chunk_id}
                  className="min-w-0 break-words rounded-md bg-gray-50 px-3 py-2 text-xs text-label"
                >
                  <span className="font-medium text-foreground">
                    {source.section ?? `Chunk ${source.chunk_index + 1}`}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {source.excerpt}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {!isUser && message.financeSummary ? (
          <TreasurySummaryCard summary={message.financeSummary} />
        ) : null}
      </div>
    </article>
  );
}
