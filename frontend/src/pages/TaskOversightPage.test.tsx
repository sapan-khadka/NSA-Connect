import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockMember } from "../test/test-utils";

vi.mock("../lib/event-tasks-api", () => ({
  fetchTaskOverview: vi.fn(),
}));

import { fetchTaskOverview } from "../lib/event-tasks-api";
import { TaskOversightPage } from "./TaskOversightPage";

const mockedOverview = vi.mocked(fetchTaskOverview);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(role: "president" | "board", position: "member" | "vice_president") {
  return render(
    <MockAuthProvider
      value={{
        member: createMockMember(role, { position }),
        isAuthenticated: true,
      }}
    >
      <MemoryRouter>
        <TaskOversightPage />
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

function taskFixture(
  overrides: Partial<{
    id: number;
    title: string;
    status: "todo" | "in_progress" | "done";
    is_overdue: boolean;
    is_complete: boolean;
    completion_note: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 1,
    event_id: 10,
    event_name: "Dashain",
    task_kind: "simple" as const,
    title: overrides.title ?? "Book venue",
    group_name: null,
    description: "",
    assignee_id: 5,
    assignee_name: "Board Member",
    status: overrides.status ?? "done",
    due_date: null,
    is_overdue: overrides.is_overdue ?? false,
    is_complete: overrides.is_complete ?? overrides.status === "done",
    checklist_items: [],
    completion_note: overrides.completion_note ?? "Reserved hall",
    completion_photo_url: null,
    completed_at: "2026-03-19T12:00:00Z",
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
  };
}

describe("TaskOversightPage", () => {
  it("blocks members without oversight permission", async () => {
    renderPage("board", "member");

    expect(
      await screen.findByText(/Only the President or Vice President/),
    ).toBeInTheDocument();
    expect(mockedOverview).not.toHaveBeenCalled();
  });

  it("renders summary stats and active assignment cards", async () => {
    mockedOverview.mockResolvedValue({
      total_tasks: 2,
      completed_tasks: 1,
      members: [
        {
          member_id: 5,
          full_name: "Board Member",
          role: "board",
          position: "event_manager",
          total: 2,
          completed: 1,
          in_progress: 0,
          todo: 1,
          completion_percent: 50,
          tasks: [taskFixture()],
        },
        {
          member_id: 6,
          full_name: "Idle Member",
          role: "board",
          position: "member",
          total: 0,
          completed: 0,
          in_progress: 0,
          todo: 0,
          completion_percent: 0,
          tasks: [],
        },
      ],
    });

    renderPage("president", "member");

    expect(await screen.findByText("Total tasks")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".ds-stat-value" })).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("50%", { selector: ".ds-stat-value" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Active assignments" })).toBeInTheDocument();
    expect(screen.getByText("Board Member")).toBeInTheDocument();
    expect(screen.getByText("Book venue")).toBeInTheDocument();
    expect(screen.getByText("Note: Reserved hall")).toBeInTheDocument();
    expect(screen.getByText("1/2 done (50%)")).toBeInTheDocument();

    const unassignedSection = screen
      .getByRole("heading", { name: "No tasks assigned" })
      .closest("section");
    expect(unassignedSection).not.toBeNull();
    expect(within(unassignedSection!).getByText("Idle Member")).toBeInTheDocument();
    expect(screen.queryByText("No tasks assigned.")).not.toBeInTheDocument();
    expect(screen.queryByText("0/0 done")).not.toBeInTheDocument();
  });

  it("sorts active members with incomplete first by default", async () => {
    mockedOverview.mockResolvedValue({
      total_tasks: 3,
      completed_tasks: 1,
      members: [
        {
          member_id: 1,
          full_name: "Almost Done",
          role: "board",
          position: "member",
          total: 2,
          completed: 1,
          in_progress: 0,
          todo: 1,
          completion_percent: 50,
          tasks: [taskFixture({ id: 1, title: "Finish setup" })],
        },
        {
          member_id: 2,
          full_name: "Needs Help",
          role: "board",
          position: "member",
          total: 1,
          completed: 0,
          in_progress: 0,
          todo: 1,
          completion_percent: 0,
          tasks: [
            taskFixture({
              id: 2,
              title: "Overdue task",
              status: "todo",
              is_overdue: true,
              is_complete: false,
              completion_note: null,
            }),
          ],
        },
        {
          member_id: 3,
          full_name: "Idle Member",
          role: "board",
          position: "member",
          total: 0,
          completed: 0,
          in_progress: 0,
          todo: 0,
          completion_percent: 0,
          tasks: [],
        },
      ],
    });

    renderPage("vice_president", "vice_president");

    expect(await screen.findByText("Needs Help")).toBeInTheDocument();

    const activeSection = screen
      .getByRole("heading", { name: "Active assignments" })
      .closest("section");
    expect(activeSection).not.toBeNull();

    const activeNames = within(activeSection!)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(activeNames).toEqual(["Needs Help", "Almost Done"]);
    expect(screen.getByText("1", { selector: ".ds-stat-overdue-chip" })).toBeInTheDocument();
  });

  it("supports alphabetical sorting for active assignments", async () => {
    mockedOverview.mockResolvedValue({
      total_tasks: 2,
      completed_tasks: 0,
      members: [
        {
          member_id: 1,
          full_name: "Zoe",
          role: "board",
          position: "member",
          total: 1,
          completed: 0,
          in_progress: 0,
          todo: 1,
          completion_percent: 0,
          tasks: [taskFixture({ id: 1, title: "Z task", completion_note: null })],
        },
        {
          member_id: 2,
          full_name: "Amy",
          role: "board",
          position: "member",
          total: 1,
          completed: 0,
          in_progress: 0,
          todo: 1,
          completion_percent: 0,
          tasks: [taskFixture({ id: 2, title: "A task", completion_note: null })],
        },
      ],
    });

    renderPage("president", "member");

    const sortSelect = await screen.findByRole("combobox");
    await userEvent.selectOptions(sortSelect, "alphabetical");

    const activeSection = screen
      .getByRole("heading", { name: "Active assignments" })
      .closest("section");
    const activeNames = within(activeSection!)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(activeNames).toEqual(["Amy", "Zoe"]);
  });
});
