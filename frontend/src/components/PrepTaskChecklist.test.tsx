import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { PrepTaskChecklist } from "./PrepTaskChecklist";
import type { PrepTaskResponse } from "../lib/events-api";

const assignableMembers: MemberResponse[] = [
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

const task: PrepTaskResponse = {
  id: 10,
  group_name: "Setup",
  due_date: "2030-06-10T12:00:00+00:00",
  assignee_id: null,
  is_overdue: true,
  is_complete: false,
  checklist_items: [
    { id: 1, label: "Reserve room", is_completed: false, sort_order: 0 },
    { id: 2, label: "Arrange chairs", is_completed: true, sort_order: 1 },
  ],
};

describe("PrepTaskChecklist", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders checklist items, progress bar, and status badges", () => {
    render(
      <PrepTaskChecklist
        task={task}
        canToggle={false}
        canAssign={false}
        assignableMembers={assignableMembers}
        onToggleItem={vi.fn()}
        onAssign={vi.fn()}
      />,
    );

    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("border-red-300");
    expect(screen.getByRole("progressbar", { name: "Task progress" })).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Task progress" }).firstChild,
    ).toHaveClass("bg-red-500");
    expect(screen.getByText("Reserve room")).toBeInTheDocument();
  });

  it("does not show overdue styling for completed tasks past due date", () => {
    render(
      <PrepTaskChecklist
        task={{ ...task, is_overdue: true, is_complete: true }}
        canToggle={false}
        canAssign={false}
        assignableMembers={assignableMembers}
        onToggleItem={vi.fn()}
        onAssign={vi.fn()}
      />,
    );

    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("border-gray-200");
    expect(
      screen.getByRole("progressbar", { name: "Task progress" }).firstChild,
    ).toHaveClass("bg-emerald-500");
  });

  it("shows assignee dropdown for board members", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();

    render(
      <PrepTaskChecklist
        task={task}
        canToggle={false}
        canAssign
        assignableMembers={assignableMembers}
        onToggleItem={vi.fn()}
        onAssign={onAssign}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Assign prep task"), "2");
    expect(onAssign).toHaveBeenCalledWith(10, 2);
  });

  it("toggles checklist items when allowed", async () => {
    const user = userEvent.setup();
    const onToggleItem = vi.fn();

    render(
      <PrepTaskChecklist
        task={task}
        canToggle
        canAssign={false}
        assignableMembers={assignableMembers}
        onToggleItem={onToggleItem}
        onAssign={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Check Reserve room" }));
    expect(onToggleItem).toHaveBeenCalledWith(10, 1, true);
  });
});
