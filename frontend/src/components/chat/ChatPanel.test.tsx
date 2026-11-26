import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamHandlers } from "../../lib/chat-stream";
import type { MemberResponse } from "../../lib/auth-api";
import { AuthContext } from "../../context/auth-context";
import {
  createMockAuthValue,
  createMockMember,
} from "../../test/test-utils";

vi.mock("../../lib/chat-stream", () => ({
  streamChatMessage: vi.fn(),
}));

import { streamChatMessage } from "../../lib/chat-stream";
import { ChatPanel } from "./ChatPanel";

const mockedStreamChatMessage = vi.mocked(streamChatMessage);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderChatPanel() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={createMockAuthValue({ member: createMockMember("general") })}
      >
        <ChatPanel />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function SessionHarness({
  initial,
  next,
}: {
  initial: MemberResponse | null;
  next: MemberResponse | null;
}) {
  const [member, setMember] = useState<MemberResponse | null>(initial);
  return (
    <MemoryRouter>
      <AuthContext.Provider value={createMockAuthValue({ member })}>
        <button type="button" onClick={() => setMember(next)}>
          Change session
        </button>
        <ChatPanel />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("ChatPanel streaming UX", () => {
  it("shows a streaming cursor and a Stop button while tokens arrive", async () => {
    const user = userEvent.setup();

    let capturedHandlers: ChatStreamHandlers | null = null;
    let resolveStream!: () => void;
    const streamGate = new Promise<void>((resolve) => {
      resolveStream = resolve;
    });

    mockedStreamChatMessage.mockImplementation(async (_request, handlers) => {
      capturedHandlers = handlers;
      handlers.onToken("Streaming");
      await streamGate;
    });

    renderChatPanel();

    await user.type(
      screen.getByLabelText("Message the AI assistant"),
      "Hello there",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Streaming")).toBeInTheDocument();
    });

    expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(capturedHandlers).not.toBeNull();

    resolveStream();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
  });

  it("keeps partial tokens and clears streaming state when Stop is clicked", async () => {
    const user = userEvent.setup();

    mockedStreamChatMessage.mockImplementation(async (_request, handlers, signal) => {
      handlers.onToken("Partial answer");
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    renderChatPanel();

    await user.type(
      screen.getByLabelText("Message the AI assistant"),
      "Tell me something",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Partial answer")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });

    expect(screen.getByText("Partial answer")).toBeInTheDocument();
    expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends the raw assistant markdown back in history", async () => {
    const user = userEvent.setup();
    mockedStreamChatMessage.mockImplementation(async (_request, handlers) => {
      handlers.onToken("**Published** minutes");
    });

    renderChatPanel();

    await user.type(screen.getByLabelText("Message the AI assistant"), "First");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Published")).toBeInTheDocument();
    });

    mockedStreamChatMessage.mockImplementation(async () => undefined);
    await user.type(screen.getByLabelText("Message the AI assistant"), "Second");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(mockedStreamChatMessage).toHaveBeenCalledTimes(2);
    });
    const secondRequest = mockedStreamChatMessage.mock.calls[1][0];
    expect(secondRequest.history?.at(-1)).toEqual({
      role: "assistant",
      content: "**Published** minutes",
    });
    expect(JSON.stringify(secondRequest.history)).not.toContain("<strong>");
  });

  it("clears messages and source cards when identity or permissions change", async () => {
    const user = userEvent.setup();
    mockedStreamChatMessage.mockImplementation(async (_request, handlers) => {
      handlers.onMetadata?.({
        constitution_sources: [
          {
            chunk_id: 4,
            chunk_index: 0,
            section: "Voting",
            excerpt: "Officers must be elected.",
            similarity_score: 0.91,
          },
        ],
        tool_calls: [],
      });
      handlers.onToken("The balance is 8800.");
    });

    render(
      <SessionHarness
        initial={createMockMember("general", { id: 4 })}
        next={createMockMember("treasurer", { id: 4 })}
      />,
    );

    await user.type(
      screen.getByLabelText("Message the AI assistant"),
      "What is the balance?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("The balance is 8800.")).toBeInTheDocument();
    });
    expect(screen.getByText("Retrieved excerpts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change session" }));

    await waitFor(() => {
      expect(screen.queryByText("The balance is 8800.")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Retrieved excerpts")).not.toBeInTheDocument();
    expect(screen.queryByText("What is the balance?")).not.toBeInTheDocument();
    expect(screen.getByText(/Hi! I can look up/)).toBeInTheDocument();
  });

  it("aborts an in-flight reply when the member signs out", async () => {
    const user = userEvent.setup();
    mockedStreamChatMessage.mockImplementation(async (_request, handlers, signal) => {
      handlers.onToken("Partial restricted answer");
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    render(
      <SessionHarness
        initial={createMockMember("general", { id: 8 })}
        next={null}
      />,
    );

    await user.type(screen.getByLabelText("Message the AI assistant"), "Keep going");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(screen.getByText("Partial restricted answer")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Change session" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Partial restricted answer"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Hi! I can look up/)).toBeInTheDocument();
  });
});
