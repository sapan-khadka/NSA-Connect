import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { MemberActivityTimeline } from "./MemberActivityTimeline";
import {
  createMemberActivityItem,
  type MemberActivityItem,
} from "../lib/member-activity-timeline";

const sampleItems: MemberActivityItem[] = [
  createMemberActivityItem({
    id: "1",
    kind: "event_checkin",
    title: "Attended Dashain Night",
    occurredAt: "2030-06-15T10:00:00",
    href: "/events/10",
  }),
  createMemberActivityItem({
    id: "2",
    kind: "dues_paid",
    title: "Paid membership dues (2026-fall)",
    occurredAt: "2030-06-14T16:00:00",
  }),
  createMemberActivityItem({
    id: "3",
    kind: "task_completed",
    title: "Completed 'Book venue' for Dashain Night",
    occurredAt: "2030-06-15T18:00:00",
    href: "/events/10",
  }),
];

describe("MemberActivityTimeline", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an empty state for tracked activity types only", () => {
    render(<MemberActivityTimeline items={[]} />);
    expect(screen.getByText("No recent activity yet.")).toBeInTheDocument();
    const kinds = screen.getByLabelText("Tracked activity");
    expect(within(kinds).getByText("Task completed")).toBeInTheDocument();
    expect(within(kinds).getByText("Dues paid")).toBeInTheDocument();
    expect(within(kinds).getByText("Event check-in")).toBeInTheDocument();
    expect(within(kinds).queryByText("Joined")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    render(<MemberActivityTimeline loading />);
    expect(screen.getByText("Loading activity…")).toBeInTheDocument();
  });

  it("renders day-grouped real activity items", () => {
    render(
      <MemoryRouter>
        <MemberActivityTimeline
          items={sampleItems}
          now={new Date("2030-06-15T15:00:00")}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Attended Dashain Night")).toBeInTheDocument();
    expect(
      screen.getByText("Paid membership dues (2026-fall)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Completed 'Book venue' for Dashain Night"),
    ).toBeInTheDocument();
  });
});
