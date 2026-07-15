import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockMember } from "../test/test-utils";

vi.mock("../lib/event-tasks-api", () => ({
  fetchTaskOverview: vi.fn(),
}));

vi.mock("../lib/members-api", () => ({
  fetchMembers: vi.fn().mockResolvedValue({
    members: [
      {
        id: 5,
        full_name: "Board Member",
        email: "board@semo.edu",
        student_id: "1",
        major: "CS",
        graduation_year: 2028,
        role: "board",
        status: "approved",
        position: "event_manager",
      },
      {
        id: 6,
        full_name: "Idle Member",
        email: "idle@semo.edu",
        student_id: "2",
        major: "CS",
        graduation_year: 2028,
        role: "board",
        status: "approved",
        position: "member",
      },
      {
        id: 2,
        full_name: "Needs Help",
        email: "needs@semo.edu",
        student_id: "3",
        major: "CS",
        graduation_year: 2028,
        role: "board",
        status: "approved",
        position: "member",
      },
    ],
    total: 3,
    page: 1,
    page_size: 100,
    total_pages: 1,
  }),
}));

import { fetchTaskOverview } from "../lib/event-tasks-api";
import { TaskOversightPage } from "./TaskOversightPage";

const mockedOverview = vi.mocked(fetchTaskOverview);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(
  role: "president" | "board",
  position: "member" | "vice_president",
) {
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
    due_date: string | null;
    assignee_has_volunteer_signup: boolean;
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
    due_date: overrides.due_date ?? null,
    is_overdue: overrides.is_overdue ?? false,
    is_complete: overrides.is_complete ?? overrides.status === "done",
    checklist_items: [],
    completion_note: overrides.completion_note ?? "Reserved hall",
    completion_photo_url: null,
    completed_at: "2026-03-19T12:00:00Z",
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
    assignee_has_volunteer_signup:
      overrides.assignee_has_volunteer_signup ?? false,
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

  it("renders team health and people-first member cards", async () => {
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
          tasks: [
            taskFixture({ id: 1, title: "Book venue", status: "done" }),
            taskFixture({
              id: 2,
              title: "Later task",
              status: "todo",
              is_complete: false,
              completion_note: null,
              due_date: "2026-08-01T12:00:00.000Z",
            }),
          ],
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

    expect(
      await screen.findByRole("heading", { name: "Today's Team Health" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Overall completion")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Needs Attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Everyone Else" }),
    ).toBeInTheDocument();

    const everyoneElse = screen
      .getByRole("heading", { name: "Everyone Else" })
      .closest("section");
    expect(everyoneElse).not.toBeNull();
    expect(
      within(everyoneElse!).getByText("Board Member"),
    ).toBeInTheDocument();
    expect(within(everyoneElse!).getByText("Idle Member")).toBeInTheDocument();
    expect(within(everyoneElse!).getByText("On Track")).toBeInTheDocument();
    expect(within(everyoneElse!).getByText("No tasks")).toBeInTheDocument();

    expect(screen.queryByText("Book venue")).not.toBeInTheDocument();

    const boardCard = screen.getByLabelText("Board Member, On Track");
    await userEvent.click(
      within(boardCard).getByRole("button", {
        name: "Expand tasks for Board Member",
      }),
    );
    expect(within(boardCard).getByText("Book venue")).toBeInTheDocument();
    expect(within(boardCard).getByText("Later task")).toBeInTheDocument();
    expect(
      within(boardCard).getByLabelText("Tasks").querySelectorAll("li"),
    ).toHaveLength(2);

    expect(
      within(boardCard).getByRole("link", {
        name: "Open Workspace for Board Member",
      }),
    ).toHaveAttribute("href", "/members/5");
    expect(
      within(boardCard).getByRole("link", { name: "Message Board Member" }),
    ).toHaveAttribute("href", "mailto:board@semo.edu");
    expect(
      within(boardCard).getByRole("link", {
        name: "Assign Task for Board Member",
      }),
    ).toHaveAttribute("href", "/events/calendar");
  });

  it("sorts Needs Attention with Overdue before At Risk by default", async () => {
    mockedOverview.mockResolvedValue({
      total_tasks: 3,
      completed_tasks: 0,
      members: [
        {
          member_id: 1,
          full_name: "At Risk Member",
          role: "board",
          position: "member",
          total: 3,
          completed: 0,
          in_progress: 0,
          todo: 3,
          completion_percent: 0,
          tasks: [
            taskFixture({
              id: 1,
              title: "Open A",
              status: "todo",
              is_complete: false,
              completion_note: null,
            }),
            taskFixture({
              id: 2,
              title: "Open B",
              status: "todo",
              is_complete: false,
              completion_note: null,
            }),
            taskFixture({
              id: 3,
              title: "Open C",
              status: "todo",
              is_complete: false,
              completion_note: null,
            }),
          ],
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
              id: 4,
              title: "Overdue task",
              status: "todo",
              is_overdue: true,
              is_complete: false,
              completion_note: null,
            }),
          ],
        },
      ],
    });

    renderPage("vice_president", "vice_president");

    expect(await screen.findByText("Needs Help")).toBeInTheDocument();

    const attention = screen
      .getByRole("heading", { name: "Needs Attention" })
      .closest("section");
    expect(attention).not.toBeNull();

    const names = within(attention!)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(names).toEqual(["Needs Help", "At Risk Member"]);
  });

  it("filters member lists when a team-health status tile is clicked", async () => {
    const user = userEvent.setup();
    mockedOverview.mockResolvedValue({
      total_tasks: 2,
      completed_tasks: 0,
      members: [
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
              id: 1,
              title: "Overdue task",
              status: "todo",
              is_overdue: true,
              is_complete: false,
              completion_note: null,
            }),
          ],
        },
        {
          member_id: 5,
          full_name: "Board Member",
          role: "board",
          position: "event_manager",
          total: 1,
          completed: 1,
          in_progress: 0,
          todo: 0,
          completion_percent: 100,
          tasks: [taskFixture({ id: 2, title: "Done", status: "done" })],
        },
      ],
    });

    renderPage("president", "member");

    expect(await screen.findByText("Needs Help")).toBeInTheDocument();
    expect(screen.getByText("Board Member")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter Overdue" }));

    expect(screen.getByText("Needs Help")).toBeInTheDocument();
    expect(screen.queryByText("Board Member")).not.toBeInTheDocument();
  });

  it("filters by assignee category", async () => {
    const user = userEvent.setup();
    mockedOverview.mockResolvedValue({
      total_tasks: 3,
      completed_tasks: 1,
      members: [
        {
          member_id: 5,
          full_name: "Board Member",
          role: "board",
          position: "event_manager",
          total: 1,
          completed: 1,
          in_progress: 0,
          todo: 0,
          completion_percent: 100,
          tasks: [taskFixture({ id: 1, title: "Book venue" })],
        },
        {
          member_id: 6,
          full_name: "apsana",
          role: "general",
          position: "member",
          total: 2,
          completed: 1,
          in_progress: 0,
          todo: 1,
          completion_percent: 50,
          tasks: [
            taskFixture({
              id: 2,
              title: "Help with tihar",
              status: "todo",
              is_complete: false,
              completion_note: null,
              assignee_has_volunteer_signup: true,
              due_date: "2026-08-01T12:00:00.000Z",
            }),
            taskFixture({
              id: 3,
              title: "Other task",
              status: "done",
              completion_note: null,
              assignee_has_volunteer_signup: false,
            }),
          ],
        },
      ],
    });

    renderPage("president", "member");

    expect(await screen.findByText("Board Member")).toBeInTheDocument();
    expect(screen.getByText("apsana")).toBeInTheDocument();

    const assigneeSelect = screen.getByRole("combobox", { name: /Assignee/i });
    await user.selectOptions(assigneeSelect, "volunteers");

    expect(screen.queryByText("Board Member")).not.toBeInTheDocument();
    expect(screen.getByText("apsana")).toBeInTheDocument();
  });
});
