import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatMessageBubble } from "./ChatMessageBubble";

afterEach(() => {
  cleanup();
});

const assistant = {
  id: "assistant-1",
  role: "assistant" as const,
};

describe("assistant markdown", () => {
  it("renders headings, lists, tables, and read-only checklists", () => {
    const { container } = render(
      <ChatMessageBubble
        message={{
          ...assistant,
          content: [
            "## Decisions",
            "",
            "The board approved **food** and *decorations*.",
            "",
            "- Treasurer prepares the breakdown",
            "1. Secretary writes the announcement",
            "",
            "- [x] Venue confirmed",
            "- [ ] Volunteers pending",
            "",
            "> Bring the agenda",
            "",
            "---",
            "",
            "| Owner | Due |",
            "| --- | --- |",
            "| Treasurer | 2026-11-26 |",
            "",
            "```",
            "room 214",
            "```",
            "",
            "[Agenda](https://nsa.example.edu/agenda)",
          ].join("\n"),
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Decisions" })).toBeInTheDocument();
    expect(screen.getByText("food").tagName).toBe("STRONG");
    expect(screen.getByText("decorations").tagName).toBe("EM");
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelector("ol")).not.toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-table-scroll")).toHaveClass(
      "w-full",
      "min-w-0",
      "overflow-x-auto",
    );
    expect(screen.getByText("2026-11-26")).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).toBeDisabled();
    }
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("pre")).not.toBeNull();
    const link = screen.getByRole("link", { name: "Agenda" });
    expect(link).toHaveAttribute("href", "https://nsa.example.edu/agenda");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("does not render scripts, remote images, iframes, or unsafe links", () => {
    const { container } = render(
      <ChatMessageBubble
        message={{
          ...assistant,
          content: [
            'Hello <script>alert(1)</script>',
            '<img src="https://evil.test/pixel.png" />',
            '<iframe src="https://evil.test/embed"></iframe>',
            "",
            "![photo](https://evil.test/photo.png)",
            "",
            "[click](javascript:alert(1))",
            "",
            "[data](data:text/html,hi)",
            "",
            "[file](file:///etc/passwd)",
          ].join("\n"),
        }}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.test");
    expect(container.innerHTML).not.toContain("javascript:");
    expect(screen.getByText("click")).toBeInTheDocument();
  });

  it("drops obfuscated links, event handlers, and partial resource markup", () => {
    const { container } = render(
      <ChatMessageBubble
        message={{
          ...assistant,
          content: [
            "[mixed](JaVaScRiPt:alert(1))",
            "[tab](java\tscript:alert(1))",
            "[protocol](//evil.test/pixel.png)",
            "[data](data:text/html,<script>alert(1)</script>)",
            "[file](file:///etc/passwd)",
            "[zero](\u200Bjavascript:alert(1))",
            '<a href="https://ok.example" onclick="alert(1)">handler</a>',
            '<img src="https://evil.test/pixel.png" onerror="alert(1)" />',
            '<source src="https://evil.test/track.png" />',
            '<iframe src="https://evil.test/embed"></iframe>',
            "![pixel](https://evil.test/pixel.png)",
            "Still open [click](javascript:alert(1)",
            "```",
            "partial fence",
          ].join("\n"),
          isStreaming: true,
        }}
      />,
    );

    expect(container.querySelector("script, img, iframe, source, video, object")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.test");
    expect(container.innerHTML).not.toContain("javascript:");
    expect(container.innerHTML).not.toContain("onclick");
    expect(container.innerHTML).not.toContain("onerror");
    expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
  });

  it("keeps wide markdown inside the bubble", () => {
    const { container } = render(
      <ChatMessageBubble
        message={{
          ...assistant,
          content: [
            `See ${"https://nsa.example.edu/".padEnd(180, "a")}`,
            "",
            `| ${"Column".repeat(12)} | ${"Value".repeat(12)} |`,
            "| --- | --- |",
            `| ${"cell".repeat(12)} | ${"cell".repeat(12)} |`,
            "",
            "```",
            "token".repeat(40),
            "```",
          ].join("\n"),
        }}
      />,
    );

    const bubble = container.querySelector("article > div");
    expect(bubble?.className).toContain("overflow-hidden");
    expect(bubble?.className).toContain("max-w-[85%]");
    expect(screen.getByTestId("markdown-table-scroll")).toHaveClass(
      "w-full",
      "min-w-0",
      "overflow-x-auto",
    );
    expect(container.querySelector("pre")).toHaveClass("overflow-x-auto");
    expect(container.querySelector(".assistant-markdown")).toHaveClass("break-words");
  });

  it("renders the server treasury card instead of a contradictory model total", () => {
    render(
      <ChatMessageBubble
        message={{
          ...assistant,
          content:
            "Here is the chapter treasury summary.\n\nThe constitution says members pay semester dues of $20.",
          financeSummary: {
            currency: "USD",
            period_label: "All recorded activity",
            total_income: "0.00",
            total_expense: "224.74",
            balance: "-224.74",
            breakdown: [
              { label: "Pre-event and general", expense: "29.89" },
              { label: "TEEJ Celebration", expense: "194.85" },
            ],
          },
        }}
      />,
    );

    const summary = screen.getByTestId("treasury-summary");
    expect(summary).toHaveTextContent("USD 0.00");
    expect(summary).toHaveTextContent("USD 224.74");
    expect(summary).toHaveTextContent("USD -224.74");
    expect(summary).toHaveTextContent("USD 29.89");
    expect(summary).toHaveTextContent("USD 194.85");
    expect(summary).toHaveTextContent("All recorded activity");
    expect(summary).toHaveTextContent("USD");
    expect(summary).not.toHaveTextContent("224.85");
    expect(summary).toHaveClass("w-full", "min-w-0", "max-w-full");
    const dues = screen.getByText(/semester dues of \$20/);
    expect(
      dues.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps user messages as plain text that can be selected", () => {
    render(
      <ChatMessageBubble
        message={{
          id: "user-1",
          role: "user",
          content: "**not bold** <script>alert(1)</script>",
        }}
      />,
    );

    const paragraph = screen.getByText("**not bold** <script>alert(1)</script>");
    expect(paragraph.tagName).toBe("P");
    expect(paragraph).toHaveClass("select-text");
    expect(paragraph.querySelector("script")).toBeNull();
    expect(paragraph.querySelector("strong")).toBeNull();
  });

  it("renders a partial streaming response without dropping the cursor", () => {
    render(
      <ChatMessageBubble
        message={{
          ...assistant,
          content: "## Still typing",
          isStreaming: true,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Still typing" })).toBeInTheDocument();
    expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
  });
});
