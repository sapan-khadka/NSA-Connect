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
      screen.getByText("This member hasn't attended in three events."),
    ).toBeInTheDocument();
    expect(screen.getByText("Outstanding dues detected.")).toBeInTheDocument();
    expect(screen.getByText("Eligible for leadership.")).toBeInTheDocument();
    expect(screen.getByText("Highly engaged member.")).toBeInTheDocument();
    expect(
      screen.getByText("Risk of becoming inactive."),
    ).toBeInTheDocument();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    expect(screen.getByText("Suggested actions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send attendance reminder" }),
    ).toBeInTheDocument();
  });

  it("acknowledges action clicks without navigating away", async () => {
    const user = userEvent.setup();
    render(<MemberAiInsightsCard />);

    await user.click(
      screen.getByRole("button", { name: "Follow up on dues" }),
    );

    expect(
      screen.getByText(
        "Action noted for review — AI suggestions are preview-only for now.",
      ),
    ).toBeInTheDocument();
  });
});
