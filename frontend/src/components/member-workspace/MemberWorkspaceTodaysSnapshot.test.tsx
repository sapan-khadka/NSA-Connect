import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import { buildMemberWorkspaceSnapshot } from "../../lib/member-workspace-snapshot";
import { MemberWorkspaceTodaysSnapshot } from "./MemberWorkspaceTodaysSnapshot";

const member: MemberResponse = {
  id: 3,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S1",
  major: "CS",
  graduation_year: 2028,
  role: "general",
  status: "approved",
  position: "member",
};

describe("MemberWorkspaceTodaysSnapshot", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders snapshot title and compact chips", () => {
    render(
      <MemberWorkspaceTodaysSnapshot
        chips={buildMemberWorkspaceSnapshot({
          member,
          openTaskCount: 1,
        })}
      />,
    );

    expect(screen.getByLabelText("Today's Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Open Tasks")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Next Event RSVP")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
