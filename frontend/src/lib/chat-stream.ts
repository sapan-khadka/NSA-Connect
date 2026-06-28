import { getAccessToken } from "./auth-token";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatConstitutionSource = {
  chunk_id: number;
  section: string | null;
  chunk_index: number;
  similarity_score: number;
  excerpt: string;
};

export type ChatToolCallRecord = {
  tool_name: string;
  input: Record<string, unknown>;
  output: string;
};

export type ChatStreamRequest = {
  message: string;
  history?: ChatHistoryMessage[];
};

export type ChatStreamMetadata = {
  constitution_sources: ChatConstitutionSource[];
  tool_calls: ChatToolCallRecord[];
};

export type ChatStreamHandlers = {
  onStatus?: (phase: string) => void;
  onToken: (text: string) => void;
  onMetadata?: (metadata: ChatStreamMetadata) => void;
  onError?: (message: string) => void;
};

type ParsedSseEvent = {
  event: string;
  data: string;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? "/api";
}

function parseSseBlock(block: string): ParsedSseEvent | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join("\n") };
}

function dispatchSseEvent(
  parsed: ParsedSseEvent,
  handlers: ChatStreamHandlers,
): void {
  const payload = JSON.parse(parsed.data) as Record<string, unknown>;

  switch (parsed.event) {
    case "status":
      handlers.onStatus?.(String(payload.phase ?? ""));
      break;
    case "token":
      handlers.onToken(String(payload.text ?? ""));
      break;
    case "metadata":
      handlers.onMetadata?.(payload as unknown as ChatStreamMetadata);
      break;
    case "error":
      handlers.onError?.(String(payload.detail ?? "Chat stream failed"));
      break;
    default:
      break;
  }
}

export async function streamChatMessage(
  request: ChatStreamRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}/v1/ai/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: request.message,
      history: request.history ?? [],
    }),
    signal,
  });

  if (!response.ok) {
    let detail = "Failed to reach AI assistant";
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        detail = body.detail;
      }
    } catch {
      // ignore JSON parse errors
    }
    handlers.onError?.(detail);
    throw new Error(detail);
  }

  if (!response.body) {
    const error = "Chat stream returned an empty response";
    handlers.onError?.(error);
    throw new Error(error);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block.trim());
      if (parsed) {
        dispatchSseEvent(parsed, handlers);
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer.trim());
    if (parsed) {
      dispatchSseEvent(parsed, handlers);
    }
  }
}
