import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MemberActivityTimeline } from "./MemberActivityTimeline";
import type { MemberActivityItem } from "../lib/member-activity-timeline";

const sampleItems: MemberActivityItem[] = [
  {
    id: "1",
    kind: "attended_event",
    title: "Attended event",
    detail: "Dashain Night",
    occurredAt: "2030-06-15T10:00:00",
  },
  {
    id: "2",
    kind: "paid_dues",
    title: "Paid dues",
    detail: "Fall 2030",
    occurredAt: "2030-06-14T16:00:00",
  },
  {
    id: "3",
    kind: "joined",
    title: "Joined organization",
    occurredAt: "2030-06-01T12:00:00",
  },
];

describe("MemberActivityTimeline", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an empty state when there is no activity", () => {
    render(<MemberActivityTimeline items={[]} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    render(<MemberActivityTimeline loading />);
    expect(screen.getByText("Loading activity…")).toBeInTheDocument();
  });

  it("renders grouped activity with icons and titles", () => {
    render(
      <MemberActivityTimeline
        items={sampleItems}
        now={new Date("2030-06-15T15:00:00")}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Attended event")).toBeInTheDocument();
    expect(screen.getByText("Paid dues")).toBeInTheDocument();
    expect(screen.getByText("Joined organization")).toBeInTheDocument();
    expect(screen.getByText("Dashain Night")).toBeInTheDocument();
  });
});
