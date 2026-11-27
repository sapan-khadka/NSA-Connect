import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import { AuthContext } from "../../context/auth-context";
import { createMockAuthValue, createMockMember } from "../../test/test-utils";
import { ChatPanel } from "./ChatPanel";

const card = {
  currency: "USD",
  period_label: "All recorded activity",
  total_income: "0.00",
  total_expense: "224.74",
  balance: "-224.74",
  breakdown: [
    { label: "Pre-event and general", expense: "29.89" },
    { label: "TEEJ Celebration", expense: "194.85" },
  ],
};

const otherCard = {
  ...card,
  total_expense: "999.00",
  balance: "-999.00",
  breakdown: [{ label: "Invented", expense: "999.00" }],
};

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function excerpts(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    chunk_id: index + 1,
    chunk_index: index,
    section: `Section ${index + 1}`,
    excerpt: `Passage ${index + 1}. ${"Neighboring constitutional text. ".repeat(12)}`,
    similarity_score: 0.2,
  }));
}

function treasurySequence(options: {
  answer: string;
  sourceCount?: number;
  includeEarlyCard?: boolean;
}) {
  const parts = [
    frame("token", { text: "Checking the ledger before the tool. " }),
    frame("reset_text", {}),
  ];
  if (options.includeEarlyCard !== false) {
    parts.push(frame("finance_summary", card));
  }
  parts.push(
    frame("token", { text: options.answer }),
    frame("metadata", {
      constitution_sources: excerpts(options.sourceCount ?? 0),
      tool_calls: [{ tool_name: "get_finance_summary", input: {}, output: "" }],
      finance_summary: card,
    }),
    frame("done", {}),
  );
  return parts.join("");
}

function sseResponse(body: string | ReadableStream<Uint8Array>) {
  const payload =
    typeof body === "string"
      ? new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            controller.close();
          },
        })
      : body;
  return new Response(payload, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function renderPanel(member: MemberResponse = createMockMember("treasurer", { id: 4 })) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={createMockAuthValue({ member })}>
        <ChatPanel />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function ask(user: ReturnType<typeof userEvent.setup>, message: string) {
  await user.type(screen.getByLabelText("Message the AI assistant"), message);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

function expectCardFollows(node: HTMLElement) {
  const summary = screen.getByTestId("treasury-summary");
  expect(
    node.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(summary).toHaveTextContent("USD 224.74");
  expect(summary).not.toHaveTextContent("999.00");
  expect(summary).not.toHaveTextContent("224.85");
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("treasury card SSE through ChatPanel", () => {
  it("shows a treasury-only card after the deterministic acknowledgement", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(
          treasurySequence({
            answer: "Here is the chapter treasury summary.",
          }),
        ),
      ),
    );
    renderPanel();
    await ask(user, "What is our treasury balance?");

    await waitFor(() => {
      expect(screen.getByText("Here is the chapter treasury summary.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Checking the ledger/)).not.toBeInTheDocument();
    expect(screen.queryByText(/displayed separately/i)).not.toBeInTheDocument();
    expectCardFollows(screen.getByText("Here is the chapter treasury summary."));
  });

  it("keeps the card after a long mixed answer and five excerpts", async () => {
    const user = userEvent.setup();
    const answer = `Cultural Night is next. ${"The board approved the food plan. ".repeat(40)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(
          treasurySequence({
            answer,
            sourceCount: 5,
          }),
        ),
      ),
    );
    renderPanel();
    await ask(user, "What is our treasury balance, and what events are coming up?");

    await waitFor(() => {
      expect(screen.getByText(/Cultural Night is next/)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Passage/)).toHaveLength(5);
    expect(screen.queryByText(/Checking the ledger/)).not.toBeInTheDocument();
    const passages = screen.getAllByText(/Passage/);
    expectCardFollows(passages[passages.length - 1]);
    expectCardFollows(screen.getByText(/Cultural Night is next/));
  });

  it("keeps the early card when final metadata repeats it", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(
          treasurySequence({
            answer: "Here is the chapter treasury summary.",
            includeEarlyCard: true,
          }),
        ),
      ),
    );
    renderPanel();
    await ask(user, "What is our treasury balance?");
    await waitFor(() => {
      expect(screen.getByTestId("treasury-summary")).toHaveTextContent("USD 224.74");
    });
  });

  it("shows the deterministic note when the secondary reply is the timeout fallback", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(
          treasurySequence({
            answer: "Here is the chapter treasury summary.",
          }),
        ),
      ),
    );
    renderPanel();
    await ask(user, "What is our treasury balance?");
    await waitFor(() => {
      expect(screen.getByText("Here is the chapter treasury summary.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/224\.85/)).not.toBeInTheDocument();
    expectCardFollows(screen.getByText("Here is the chapter treasury summary."));
  });

  it("does not attach a late card after the account changes", async () => {
    const user = userEvent.setup();
    const late: { release: () => void } = {
      release: () => {
        throw new Error("late continuation was not captured");
      },
    };
    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    treasurySequence({
                      answer: "Here is the chapter treasury summary.",
                    }),
                  ),
                );
                return new Promise<void>((resolve) => {
                  late.release = () => {
                    controller.enqueue(
                      encoder.encode(
                        [
                          frame("finance_summary", otherCard),
                          frame("token", { text: "Late prose for the previous account." }),
                          frame("metadata", {
                            constitution_sources: excerpts(1),
                            tool_calls: [],
                            finance_summary: otherCard,
                          }),
                        ].join(""),
                      ),
                    );
                    controller.close();
                    resolve();
                  };
                });
              },
            }),
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    function Harness() {
      const [member, setMember] = useState<MemberResponse | null>(
        createMockMember("treasurer", { id: 9 }),
      );
      return (
        <MemoryRouter>
          <AuthContext.Provider value={createMockAuthValue({ member })}>
            <button type="button" onClick={() => setMember(createMockMember("general", { id: 10 }))}>
              Change session
            </button>
            <ChatPanel />
          </AuthContext.Provider>
        </MemoryRouter>
      );
    }

    render(<Harness />);
    await ask(user, "What is our treasury balance?");
    await waitFor(() => {
      expect(screen.getByTestId("treasury-summary")).toHaveTextContent("USD 224.74");
    });
    await user.click(screen.getByRole("button", { name: "Change session" }));
    await waitFor(() => {
      expect(screen.queryByTestId("treasury-summary")).not.toBeInTheDocument();
    });
    late.release();
    await waitFor(() => {
      expect(screen.getByText(/Hi! I can look up/)).toBeInTheDocument();
    });
    expect(screen.queryByText("USD 999.00")).not.toBeInTheDocument();
    expect(screen.queryByText("Late prose for the previous account.")).not.toBeInTheDocument();
  });
});
