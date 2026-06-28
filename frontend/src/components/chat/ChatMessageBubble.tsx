import type { ChatConstitutionSource } from "../../lib/chat-stream";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  statusLabel?: string;
  constitutionSources?: ChatConstitutionSource[];
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
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "rounded-br-md bg-accent text-white"
            : "rounded-bl-md border border-gray-200 bg-white text-primary",
        ].join(" ")}
      >
        {message.statusLabel && !message.content ? (
          <p className="text-gray-500">{message.statusLabel}</p>
        ) : (
          <p className="whitespace-pre-wrap">
            {message.content || " "}
            {!isUser && message.isStreaming ? (
              <span
                aria-hidden="true"
                data-testid="streaming-cursor"
                className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-current align-baseline"
              />
            ) : null}
          </p>
        )}

        {!isUser && message.constitutionSources && message.constitutionSources.length > 0 ? (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Constitution sources
            </p>
            <ul className="mt-2 space-y-2">
              {message.constitutionSources.map((source) => (
                <li
                  key={source.chunk_id}
                  className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600"
                >
                  <span className="font-medium text-primary">
                    {source.section ?? `Chunk ${source.chunk_index + 1}`}
                  </span>
                  <p className="mt-1 line-clamp-3">{source.excerpt}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
