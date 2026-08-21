import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MemberAiInsightsCard } from "./MemberAiInsightsCard";

describe("MemberAiInsightsCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an unavailable state without invented insights", () => {
    render(<MemberAiInsightsCard />);

    expect(screen.getByLabelText("AI Insights")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("AI insights are not available yet"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Member has missed four events."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/No backend AI is generating insights/i),
    ).toBeInTheDocument();
  });
});
