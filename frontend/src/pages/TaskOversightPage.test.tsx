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

function renderPage(
  role: "president" | "board",
  position: "member" | "vice_president",
  initialEntry = "/events/oversight",
) {
  return render(
    <MockAuthProvider
      value={{
        member: createMockMember(role, { position }),
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
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
    assignee_name: string;
    assignee_id: number;
    event_id: number;
    event_name: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 1,
    event_id: overrides.event_id ?? 10,
    event_name: overrides.event_name ?? "Dashain",
    task_kind: "simple" as const,
    title: overrides.title ?? "Book venue",
    group_name: null,
    description: "",
    assignee_id: overrides.assignee_id ?? 5,
    assignee_name: overrides.assignee_name ?? "Board Member",
    status: overrides.status ?? "done",
    due_date: overrides.due_date ?? null,
    is_overdue: overrides.is_overdue ?? false,
    is_complete: overrides.is_complete ?? overrides.status === "done",
    checklist_items: [],
    completion_note: overrides.completion_note ?? null,
    completion_photo_url: null,
    completed_at: "2026-03-19T12:00:00Z",
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
    assignee_has_volunteer_signup: false,
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

  it("scopes operations to the selected event", async () => {
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
          total: 2,
          completed: 1,
          in_progress: 1,
          todo: 0,
          completion_percent: 50,
          tasks: [
            taskFixture({
              id: 1,
              title: "Book venue",
              status: "done",
              event_id: 10,
              event_name: "Dashain",
            }),
            taskFixture({
              id: 2,
              title: "Social Media Campaign",
              status: "in_progress",
              is_complete: false,
              due_date: "2030-08-01T12:00:00.000Z",
              event_id: 10,
              event_name: "Dashain",
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
              id: 3,
              title: "Holidays Flyer",
              status: "todo",
              is_overdue: true,
              is_complete: false,
              assignee_id: 2,
              assignee_name: "Needs Help",
              event_id: 22,
              event_name: "Tihar",
            }),
          ],
        },
      ],
    });

    renderPage("president", "member", "/events/oversight?event=10");

    const eventSelect = await screen.findByLabelText("Event");
    expect(eventSelect).toHaveValue("10");

    const ops = screen.getByLabelText("Event operations");
    expect(
      within(ops).getByLabelText("Upcoming"),
    ).toHaveTextContent("Social Media Campaign");
    expect(
      within(ops).getByLabelText("Completed"),
    ).toHaveTextContent("Book venue");
    expect(within(ops).queryByText("Holidays Flyer")).not.toBeInTheDocument();

    expect(screen.getByLabelText("Progress")).toBeInTheDocument();
    expect(screen.getByText(/tasks completed/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Issues")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New Task/i })).toHaveAttribute(
      "href",
      "/events/10/manage",
    );

    await user.selectOptions(eventSelect, "22");

    expect(eventSelect).toHaveValue("22");
    const nextOps = screen.getByLabelText("Event operations");
    expect(within(nextOps).getByText("Holidays Flyer")).toBeInTheDocument();
    expect(
      within(nextOps).queryByText("Social Media Campaign"),
    ).not.toBeInTheDocument();
    expect(within(nextOps).queryByText("Book venue")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New Task/i })).toHaveAttribute(
      "href",
      "/events/22/manage",
    );
  });

  it("surfaces overdue work in Issues", async () => {
    mockedOverview.mockResolvedValue({
      total_tasks: 1,
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
              id: 3,
              title: "Holidays Flyer",
              status: "todo",
              is_overdue: true,
              is_complete: false,
              due_date: "2020-01-01T12:00:00.000Z",
              assignee_id: 2,
              assignee_name: "Needs Help",
              event_id: 22,
              event_name: "Tihar",
            }),
          ],
        },
      ],
    });

    renderPage("president", "member");

    const issues = await screen.findByLabelText("Issues");
    expect(within(issues).getByText("Holidays Flyer")).toBeInTheDocument();
    expect(within(issues).getByText(/Needs Help/)).toBeInTheDocument();
    expect(within(issues).getByText(/overdue/i)).toBeInTheDocument();
  });
});
