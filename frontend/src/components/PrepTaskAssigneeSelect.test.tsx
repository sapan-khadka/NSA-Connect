import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { PrepTaskAssigneeSelect } from "./PrepTaskAssigneeSelect";

const members: MemberResponse[] = [
  {
    id: 2,
    full_name: "Board Member",
    email: "board@semo.edu",
    student_id: "87654321",
    major: "Administration",
    graduation_year: 2028,
    role: "board",
    status: "approved",
    position: "member",
  },
];

describe("PrepTaskAssigneeSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onAssign when a board member is selected", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();

    render(
      <PrepTaskAssigneeSelect
        assigneeId={null}
        assignableMembers={members}
        onAssign={onAssign}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Assign prep task"), "2");
    expect(onAssign).toHaveBeenCalledWith(2);
  });

  it("calls onAssign with null when unassigned is selected", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();

    render(
      <PrepTaskAssigneeSelect
        assigneeId={2}
        assignableMembers={members}
        onAssign={onAssign}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Assign prep task"), "");
    expect(onAssign).toHaveBeenCalledWith(null);
  });
});
