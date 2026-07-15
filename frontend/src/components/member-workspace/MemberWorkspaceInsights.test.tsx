import { cleanup, render, screen, within } from "@testing-library/react";
import { CalendarOff } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { MemberWorkspaceInsights } from "./MemberWorkspaceInsights";

describe("MemberWorkspaceInsights", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows neutral empty state when no rules fire", () => {
    render(<MemberWorkspaceInsights insights={[]} />);
    const section = screen.getByLabelText("AI Insights");
    expect(
      within(section).getByText("No notable patterns right now."),
    ).toBeInTheDocument();
    expect(within(section).queryByText(/all good/i)).not.toBeInTheDocument();
  });

  it("renders insight rows with icon and message", () => {
    render(
      <MemberWorkspaceInsights
        insights={[
          {
            id: "missed_meetings",
            tone: "attention",
            message: "Hasn't attended the last 3 meetings.",
            icon: CalendarOff,
          },
        ]}
      />,
    );
    const section = screen.getByLabelText("AI Insights");
    expect(
      within(section).getByText("Hasn't attended the last 3 meetings."),
    ).toBeInTheDocument();
  });
});
