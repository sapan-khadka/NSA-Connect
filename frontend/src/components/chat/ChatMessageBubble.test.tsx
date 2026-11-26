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
    expect(screen.getByTestId("markdown-table-scroll")).toHaveClass("overflow-x-auto");
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
