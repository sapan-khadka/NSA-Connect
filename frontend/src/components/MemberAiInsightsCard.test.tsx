import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { MemberAiInsightsCard } from "./MemberAiInsightsCard";

describe("MemberAiInsightsCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders placeholder insights, suggestions, and actions", () => {
    render(<MemberAiInsightsCard />);

    expect(screen.getByLabelText("AI Insights")).toBeInTheDocument();
    expect(
      screen.getByText("Member has missed four events."),
    ).toBeInTheDocument();
    expect(screen.getByText("Member is highly engaged.")).toBeInTheDocument();
    expect(screen.getByText("Recommend leadership role.")).toBeInTheDocument();
    expect(screen.getByText("Outstanding dues.")).toBeInTheDocument();
    expect(
      screen.getByText("Recommend sending reminder."),
    ).toBeInTheDocument();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    expect(screen.getByText("Suggested actions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reminder" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Placeholder UX only/i),
    ).toBeInTheDocument();
  });

  it("acknowledges action clicks without calling a backend", async () => {
    const user = userEvent.setup();
    render(<MemberAiInsightsCard />);

    await user.click(screen.getByRole("button", { name: "Follow up on dues" }));

    expect(
      screen.getByText(
        "Action noted for review — AI suggestions are preview-only for now.",
      ),
    ).toBeInTheDocument();
  });
});
