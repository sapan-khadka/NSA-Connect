import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import { buildMemberWorkspaceSnapshot } from "../../lib/member-workspace-snapshot";
import { MemberWorkspaceHeader } from "./MemberWorkspaceHeader";
import { MemberWorkspaceLayout } from "./MemberWorkspaceLayout";
import { MemberWorkspaceTodaysSnapshot } from "./MemberWorkspaceTodaysSnapshot";

const member: MemberResponse = {
  id: 3,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S1",
  major: "Computer Science",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "member",
};

describe("MemberWorkspaceLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders header, today's snapshot, and section placeholders", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceLayout
          header={<MemberWorkspaceHeader member={member} />}
          overview={
            <MemberWorkspaceTodaysSnapshot
              chips={buildMemberWorkspaceSnapshot({
                member,
                openTaskCount: null,
              })}
            />
          }
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Alex Member" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Today's Snapshot")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Today's Snapshot" }),
    ).toBeInTheDocument();

    const workspace = screen.getByLabelText("Member workspace");
    for (const title of [
      "Overview",
      "Health",
      "Attendance",
      "Tasks",
      "Payments",
      "Upcoming Events",
      "Activity Timeline",
      "Notes",
      "Documents",
      "AI Insights",
    ]) {
      expect(
        within(workspace).getByRole("region", { name: title }),
      ).toBeInTheDocument();
    }
  });

  it("replaces the Tasks placeholder when responsibilities are provided", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceLayout
          header={<MemberWorkspaceHeader member={member} />}
          responsibilities={
            <section aria-label="Current Responsibilities">
              <h2>Current Responsibilities</h2>
            </section>
          }
          schedule={
            <section aria-label="Upcoming Schedule">
              <h2>Upcoming Schedule</h2>
            </section>
          }
        />
      </MemoryRouter>,
    );

    const workspace = screen.getByLabelText("Member workspace");
    expect(
      within(workspace).getByRole("region", {
        name: "Current Responsibilities",
      }),
    ).toBeInTheDocument();
    expect(
      within(workspace).getByRole("region", { name: "Upcoming Schedule" }),
    ).toBeInTheDocument();
    expect(
      within(workspace).queryByRole("region", { name: "Tasks" }),
    ).not.toBeInTheDocument();
  });
});
