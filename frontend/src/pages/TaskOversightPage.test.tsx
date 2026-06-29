import { cleanup, render, screen } from "@testing-library/react";
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

describe("TaskOversightPage", () => {
  it("blocks members without oversight permission", async () => {
    renderPage("board", "member");

    expect(
      await screen.findByText(/Only the President or Vice President/),
    ).toBeInTheDocument();
    expect(mockedOverview).not.toHaveBeenCalled();
  });

  it("renders per-member completion for the president", async () => {
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
            {
              id: 1,
              event_id: 10,
              event_name: "Dashain",
              task_kind: "simple",
              title: "Book venue",
              group_name: null,
              description: "",
              assignee_id: 5,
              assignee_name: "Board Member",
              status: "done",
              due_date: null,
              is_overdue: false,
              is_complete: true,
              checklist_items: [],
              completion_note: "Reserved hall",
              completion_photo_url: null,
              completed_at: "2026-03-19T12:00:00Z",
              created_by_id: 1,
              created_at: "2026-03-18T12:00:00Z",
            },
          ],
        },
      ],
    });

    renderPage("president", "member");

    expect(await screen.findByText("Board Member")).toBeInTheDocument();
    expect(screen.getByText("Book venue")).toBeInTheDocument();
    expect(screen.getByText("Note: Reserved hall")).toBeInTheDocument();
    expect(screen.getByText("1/2 done (50%)")).toBeInTheDocument();
  });
});
