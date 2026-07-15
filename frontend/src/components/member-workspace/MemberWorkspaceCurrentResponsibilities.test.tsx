import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { MemberResponsibilityItem } from "../../lib/member-workspace-responsibilities";
import { MemberWorkspaceCurrentResponsibilities } from "./MemberWorkspaceCurrentResponsibilities";

const sampleItems: MemberResponsibilityItem[] = [
  {
    id: 7,
    title: "Book venue",
    eventName: "Dashain",
    status: "todo",
    statusLabel: "To do",
    dueDateLabel: "Aug 1, 2026",
    isOverdue: false,
    assignedByLabel: null,
    progress: null,
    detailPath: "/events/10/manage",
  },
];

describe("MemberWorkspaceCurrentResponsibilities", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders task rows with status, due, and assigned-by placeholders", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceCurrentResponsibilities
          items={sampleItems}
          viewAllPath="/events/oversight"
          assignTaskPath="/events/calendar"
        />
      </MemoryRouter>,
    );

    const section = screen.getByLabelText("Current Responsibilities");
    expect(
      within(section).getByRole("heading", {
        name: "Current Responsibilities",
      }),
    ).toBeInTheDocument();
    expect(within(section).getByText("Book venue")).toBeInTheDocument();
    expect(within(section).getByText("To do")).toBeInTheDocument();
    expect(within(section).getByText("Aug 1, 2026")).toBeInTheDocument();
    expect(within(section).getByText("—")).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: "Open Book venue" }),
    ).toHaveAttribute("href", "/events/10/manage");
    expect(
      within(section).getByRole("link", { name: /View All/i }),
    ).toHaveAttribute("href", "/events/oversight");
  });

  it("shows premium empty state with assign link when allowed", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceCurrentResponsibilities
          items={[]}
          viewAllPath="/events/tasks"
          assignTaskPath="/events/calendar"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("No current responsibilities.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Assign a task" }),
    ).toHaveAttribute("href", "/events/calendar");
  });

  it("hides assign link when the viewer cannot manage tasks", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceCurrentResponsibilities
          items={[]}
          viewAllPath="/events/tasks"
          assignTaskPath={null}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("No current responsibilities.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Assign a task" }),
    ).not.toBeInTheDocument();
  });
});
