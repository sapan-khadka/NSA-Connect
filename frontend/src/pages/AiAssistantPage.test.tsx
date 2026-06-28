import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";
import type { ChatStreamMetadata } from "../lib/chat-stream";

vi.mock("../lib/chat-stream", () => ({
  streamChatMessage: vi.fn(
    async (
      _request,
      handlers: {
        onStatus?: (phase: string) => void;
        onToken: (text: string) => void;
        onMetadata?: (metadata: ChatStreamMetadata) => void;
      },
    ) => {
      handlers.onStatus?.("thinking");
      handlers.onToken("According ");
      handlers.onToken("to the constitution.");
      handlers.onMetadata?.({
        constitution_sources: [
          {
            chunk_id: 1,
            section: "Article I",
            chunk_index: 0,
            similarity_score: 0.92,
            excerpt: "Officers must be elected by a majority vote.",
          },
        ],
        tool_calls: [],
      });
    },
  ),
}));

describe("AiAssistantPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders chat history, streams assistant reply, and shows constitution sources", async () => {
    const user = userEvent.setup();

    renderWithRouter(undefined, {
      initialEntries: ["/assistant"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(
      screen.getByText(/answer constitution questions/i),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Message the AI assistant"),
      "How are officers elected?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(
        screen.getByText("According to the constitution."),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Constitution sources")).toBeInTheDocument();
    expect(
      screen.getByText("Officers must be elected by a majority vote."),
    ).toBeInTheDocument();
  });
});
