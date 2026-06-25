import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrepTaskChecklist } from "./PrepTaskChecklist";
import type { PrepTaskResponse } from "../lib/events-api";

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
        onToggleItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Task progress" })).toBeInTheDocument();
    expect(screen.getByText("1/2 (50%)")).toBeInTheDocument();
    expect(screen.getByText("Reserve room")).toBeInTheDocument();
  });

  it("toggles checklist items when allowed", async () => {
    const user = userEvent.setup();
    const onToggleItem = vi.fn();

    render(
      <PrepTaskChecklist
        task={task}
        canToggle
        onToggleItem={onToggleItem}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Check Reserve room" }));
    expect(onToggleItem).toHaveBeenCalledWith(10, 1, true);
  });
});
