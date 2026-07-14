import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MemberActivityTimeline } from "./MemberActivityTimeline";
import {
  buildPlaceholderMemberActivity,
  createMemberActivityItem,
  type MemberActivityItem,
} from "../lib/member-activity-timeline";

const sampleItems: MemberActivityItem[] = [
  createMemberActivityItem({
    id: "1",
    kind: "attended_event",
    detail: "Dashain Night",
    occurredAt: "2030-06-15T10:00:00",
  }),
  createMemberActivityItem({
    id: "2",
    kind: "paid_dues",
    detail: "Fall 2030",
    occurredAt: "2030-06-14T16:00:00",
  }),
  createMemberActivityItem({
    id: "3",
    kind: "joined",
    occurredAt: "2030-06-01T12:00:00",
  }),
  createMemberActivityItem({
    id: "4",
    kind: "completed_task",
    detail: "Poster upload",
    occurredAt: "2030-06-15T18:00:00",
  }),
  createMemberActivityItem({
    id: "5",
    kind: "assigned_committee",
    detail: "Events",
    occurredAt: "2030-06-10T09:00:00",
  }),
];

describe("MemberActivityTimeline", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an empty state with supported event chips", () => {
    render(<MemberActivityTimeline items={[]} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    const kinds = screen.getByLabelText("Supported events");
    expect(within(kinds).getByText("Joined")).toBeInTheDocument();
    expect(within(kinds).getByText("Paid dues")).toBeInTheDocument();
    expect(within(kinds).getByText("Attended event")).toBeInTheDocument();
    expect(within(kinds).getByText("Completed task")).toBeInTheDocument();
    expect(within(kinds).getByText("Assigned committee")).toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    render(<MemberActivityTimeline loading />);
    expect(screen.getByText("Loading activity…")).toBeInTheDocument();
  });

  it("renders day-grouped activity for every event type", () => {
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
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByText("Completed task")).toBeInTheDocument();
    expect(screen.getByText("Assigned committee")).toBeInTheDocument();
    expect(screen.getByText("Dashain Night")).toBeInTheDocument();
  });

  it("can render placeholder milestones when empty", () => {
    const now = new Date("2030-06-15T15:00:00");
    render(
      <MemberActivityTimeline placeholdersWhenEmpty now={now} />,
    );

    expect(screen.getByText(/Sample timeline/i)).toBeInTheDocument();
    expect(buildPlaceholderMemberActivity(now)).toHaveLength(5);
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByText("Paid dues")).toBeInTheDocument();
    expect(screen.getByText("Attended event")).toBeInTheDocument();
    expect(screen.getByText("Completed task")).toBeInTheDocument();
    expect(screen.getByText("Assigned committee")).toBeInTheDocument();
  });
});
