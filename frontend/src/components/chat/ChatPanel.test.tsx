import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamHandlers } from "../../lib/chat-stream";

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

    render(<ChatPanel />);

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

    render(<ChatPanel />);

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
});
