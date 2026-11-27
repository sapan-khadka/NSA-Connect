import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { ChatPanel } from "../components/chat/ChatPanel";
import { AuthContext, type AuthContextValue } from "../context/auth-context";
import type { MemberResponse, TokenResponse } from "../lib/auth-api";
import "../index.css";
import "../app-brand.css";

const card = {
  currency: "USD" as const,
  period_label: "All recorded activity",
  total_income: "0.00",
  total_expense: "224.74",
  balance: "-224.74",
  breakdown: [
    { label: "Pre-event and general", expense: "29.89" },
    { label: "TEEJ Celebration", expense: "194.85" },
  ],
};

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function excerpts() {
  return Array.from({ length: 5 }, (_, index) => ({
    chunk_id: index + 1,
    chunk_index: index,
    section: `Section ${index + 1}`,
    excerpt: `Passage ${index + 1}. ${"Neighboring constitutional text. ".repeat(18)}`,
    similarity_score: 0.22,
  }));
}

function publish(result: Record<string, unknown>) {
  const node = document.querySelector("#viewport-result");
  if (node) {
    node.textContent = JSON.stringify(result);
  }
}

function waitFor(predicate: () => boolean, timeoutMs = 5000) {
  const started = performance.now();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setInterval(() => {
      if (predicate()) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (performance.now() - started > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("timed out waiting for the treasury card"));
      }
    }, 30);
  });
}

const params = new URLSearchParams(window.location.search);
const width = Number(params.get("width") ?? "390");
const mode = params.get("case") ?? "excerpts";
const park = params.get("park") !== "0";
const answer =
  mode === "long"
    ? `Cultural Night is next. ${"The board approved the food plan. ".repeat(50)}`
    : "Here is the chapter treasury summary.";
const sourceCount = mode === "treasury" ? 0 : 5;

const opening = [
  frame("token", { text: "Checking the ledger before the tool. " }),
  frame("reset_text", {}),
  frame("finance_summary", card),
  frame("token", { text: answer }),
  frame("metadata", {
    constitution_sources: excerpts().slice(0, sourceCount),
    tool_calls: [],
    finance_summary: card,
  }),
].join("");

const member: MemberResponse = {
  id: 4,
  full_name: "Vice President",
  email: "vp@semo.edu",
  student_id: "61001012",
  major: "Biology",
  graduation_year: 2028,
  role: "treasurer",
  status: "approved",
  position: "vice_president",
};

const auth: AuthContextValue = {
  token: "viewport-token",
  member,
  isAuthenticated: true,
  isLoading: false,
  login: async (_tokens: TokenResponse) => member,
  updateSessionTokens: () => undefined,
  logout: () => undefined,
  updateMember: () => undefined,
};

window.fetch = async () =>
  new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          controller.enqueue(encoder.encode(opening));
          await waitFor(() => document.querySelector("[data-testid='treasury-summary']") !== null);
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          const frameElement = document.querySelector("[data-testid='viewport-frame']");
          const scroller = document.querySelector("[data-testid='chat-transcript']");
          const summary = document.querySelector("[data-testid='treasury-summary']");
          if (
            !(frameElement instanceof HTMLElement) ||
            !(scroller instanceof HTMLElement) ||
            !(summary instanceof HTMLElement)
          ) {
            throw new Error("layout nodes were missing");
          }
          const scrollerRect = scroller.getBoundingClientRect();
          const cardRect = summary.getBoundingClientRect();
          const balance = Array.from(summary.querySelectorAll("dt")).find(
            (node) => node.textContent === "Balance",
          )?.parentElement;
          const balanceRect =
            balance instanceof HTMLElement ? balance.getBoundingClientRect() : null;
          const distanceFromBottom =
            scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
          if (park) {
            scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -160, bubbles: true }));
            scroller.scrollTop = 0;
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
            controller.enqueue(
              encoder.encode(
                frame("token", { text: " A later sentence arrives after scrolling up." }),
              ),
            );
          }
          controller.enqueue(encoder.encode(frame("done", {})));
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          publish({
            ready: true,
            width,
            innerWidth: window.innerWidth,
            mode,
            frameOverflow: frameElement.scrollWidth - frameElement.clientWidth,
            cardOverflow: summary.scrollWidth - summary.clientWidth,
            balanceVisible: balanceRect
              ? balanceRect.top >= scrollerRect.top - 1 &&
                balanceRect.bottom <= scrollerRect.bottom + 1
              : false,
            cardIntersectsScroller:
              cardRect.bottom > scrollerRect.top && cardRect.top < scrollerRect.bottom,
            distanceFromBottom: Math.round(distanceFromBottom),
            scrollAfterUpdate: Math.round(scroller.scrollTop),
          });
        } catch (error) {
          publish({
            ready: false,
            width,
            mode,
            error: error instanceof Error ? error.message : "viewport check failed",
          });
        } finally {
          controller.close();
        }
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );

export function Harness() {
  useEffect(() => {
    document.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  }, []);

  return (
    <MemoryRouter initialEntries={["/?q=What%20is%20our%20treasury%20balance%3F"]}>
      <AuthContext.Provider value={auth}>
        <div
          data-testid="viewport-frame"
          style={{ width, height: 700 }}
          className="overflow-hidden"
        >
          <ChatPanel />
        </div>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
