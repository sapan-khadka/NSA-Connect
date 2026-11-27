import { describe, expect, it, vi } from "vitest";

import { streamChatMessage } from "./chat-stream";

function buildSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("streamChatMessage", () => {
  it("parses token, metadata, and done events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse([
          'event: status\ndata: {"phase":"thinking"}\n\n',
          'event: token\ndata: {"text":"Hello"}\n\n',
          'event: token\ndata: {"text":" world"}\n\n',
          'event: finance_summary\ndata: {"currency":"USD","period_label":"All recorded activity","total_income":"0.00","total_expense":"224.74","balance":"-224.74","breakdown":[]}\n\n',
          'event: metadata\ndata: {"constitution_sources":[],"tool_calls":[]}\n\n',
          "event: done\ndata: {}\n\n",
        ]),
      ),
    );

    const tokens: string[] = [];
    let metadataReceived = false;
    let financeSummary: unknown;

    await streamChatMessage(
      { message: "Hi" },
      {
        onToken: (text) => tokens.push(text),
        onFinanceSummary: (summary) => {
          financeSummary = summary;
        },
        onMetadata: () => {
          metadataReceived = true;
        },
      },
    );

    expect(tokens).toEqual(["Hello", " world"]);
    expect(metadataReceived).toBe(true);
    expect(financeSummary).toMatchObject({ total_expense: "224.74" });
  });
});
