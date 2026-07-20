import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import { buildMemberWorkspaceSnapshot } from "../../lib/member-workspace-snapshot";
import { MockAuthProvider } from "../../test/test-utils";
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

function renderLayout(ui: React.ReactNode) {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "Board User",
          email: "board@semo.edu",
          student_id: "1",
          major: "Admin",
          graduation_year: 2028,
          role: "board",
          status: "approved",
          position: "member",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("MemberWorkspaceLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders header and snapshot without hollow placeholders", () => {
    renderLayout(
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
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Alex Member" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Today's Snapshot")).toBeInTheDocument();
    expect(screen.queryByLabelText("Member workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("renders Private Notes only when the privateNotes slot is provided", () => {
    renderLayout(
      <MemberWorkspaceLayout
        header={<MemberWorkspaceHeader member={member} />}
        privateNotes={
          <section aria-label="Private Notes">
            <h2>Private Notes</h2>
          </section>
        }
        documents={
          <section aria-label="Documents">
            <h2>Documents</h2>
          </section>
        }
      />,
    );

    const aside = screen.getByLabelText("Sidebar");
    expect(
      within(aside).getByRole("region", { name: "Private Notes" }),
    ).toBeInTheDocument();
  });

  it("renders only provided workspace sections", () => {
    renderLayout(
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
        recentActivity={
          <section aria-label="Recent Activity">
            <h2>Recent Activity</h2>
          </section>
        }
        financialStatus={
          <section aria-label="Financial Status">
            <h2>Financial Status</h2>
          </section>
        }
        documents={
          <section aria-label="Documents">
            <h2>Documents</h2>
          </section>
        }
        insights={
          <section aria-label="AI Insights">
            <h2>AI Insights</h2>
          </section>
        }
      />,
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
      within(workspace).getByRole("region", { name: "Recent Activity" }),
    ).toBeInTheDocument();
    expect(
      within(workspace).getByRole("region", { name: "Financial Status" }),
    ).toBeInTheDocument();
    expect(
      within(workspace).getByRole("region", { name: "Documents" }),
    ).toBeInTheDocument();
    expect(
      within(workspace).getByRole("region", { name: "AI Insights" }),
    ).toBeInTheDocument();
    expect(
      within(workspace).queryByRole("region", { name: "Overview" }),
    ).not.toBeInTheDocument();
    expect(
      within(workspace).queryByRole("region", { name: "Attendance" }),
    ).not.toBeInTheDocument();
    expect(
      within(workspace).queryByRole("region", { name: "Health" }),
    ).not.toBeInTheDocument();
  });
});
