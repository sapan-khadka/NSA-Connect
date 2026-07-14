import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { computeMemberHealth } from "../lib/member-health";
import { MemberHealthPanel } from "./MemberHealthPanel";

describe("MemberHealthPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders score, factors, band, and suggestions", () => {
    const snapshot = computeMemberHealth({ memberId: 12, role: "general" });

    render(<MemberHealthPanel snapshot={snapshot} embedded />);

    const panel = screen.getByLabelText("Member health");
    expect(within(panel).getByText("Health Score")).toBeInTheDocument();
    expect(
      panel.querySelector(".member-health-score-value"),
    ).toHaveTextContent(String(snapshot.score));
    expect(within(panel).getByText(snapshot.bandLabel)).toBeInTheDocument();

    const factors = within(panel).getByLabelText("Health factors");
    expect(within(factors).getByText("Attendance")).toBeInTheDocument();
    expect(within(factors).getByText("Task Completion")).toBeInTheDocument();
    expect(within(factors).getByText("Payment Status")).toBeInTheDocument();
    expect(within(factors).getByText("Recent Activity")).toBeInTheDocument();

    expect(within(panel).getByText("Suggestions")).toBeInTheDocument();
    expect(snapshot.suggestions.length).toBeGreaterThan(0);
    expect(
      within(panel).getByText(snapshot.suggestions[0]!.text),
    ).toBeInTheDocument();
  });
});
