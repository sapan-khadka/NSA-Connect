import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { ScheduleCommitment } from "../../lib/member-workspace-schedule";
import { MemberWorkspaceUpcomingSchedule } from "./MemberWorkspaceUpcomingSchedule";

const items: ScheduleCommitment[] = [
  {
    id: "event-1",
    kind: "event",
    kindLabel: "Event",
    title: "Dashain Celebration",
    detail: "Going",
    startsAt: "2030-06-15T18:00:00.000Z",
    whenLabel: "Tomorrow • 6:00 PM",
    href: "/events/10",
  },
];

describe("MemberWorkspaceUpcomingSchedule", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders commitment rows matching responsibilities card treatment", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceUpcomingSchedule items={items} hasMore={false} />
      </MemoryRouter>,
    );

    const section = screen.getByLabelText("Upcoming Schedule");
    expect(
      within(section).getByRole("heading", { name: "Upcoming Schedule" }),
    ).toBeInTheDocument();
    expect(within(section).getByText("Dashain Celebration")).toBeInTheDocument();
    expect(within(section).getByText("Event")).toBeInTheDocument();
    expect(within(section).getByText("Tomorrow • 6:00 PM")).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: "Open Dashain Celebration" }),
    ).toHaveAttribute("href", "/events/10");
    expect(
      within(section).queryByRole("link", { name: /View all/i }),
    ).not.toBeInTheDocument();
  });

  it("shows empty state and View all when more items exist", () => {
    const { rerender } = render(
      <MemoryRouter>
        <MemberWorkspaceUpcomingSchedule items={[]} hasMore={false} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Nothing on the schedule yet."),
    ).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MemberWorkspaceUpcomingSchedule items={items} hasMore />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /View all/i })).toHaveAttribute(
      "href",
      "/events/calendar",
    );
  });
});
