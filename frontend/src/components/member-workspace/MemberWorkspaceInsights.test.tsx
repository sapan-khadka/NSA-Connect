import { cleanup, render, screen, within } from "@testing-library/react";
import { CalendarOff } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { MemberWorkspaceInsights } from "./MemberWorkspaceInsights";

describe("MemberWorkspaceInsights", () => {
  afterEach(() => {
    cleanup();
  });

  it("hides the card when no rules fire", () => {
    const { container } = render(<MemberWorkspaceInsights insights={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("AI Insights")).not.toBeInTheDocument();
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
