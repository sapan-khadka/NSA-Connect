import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";

vi.mock("../lib/event-tasks-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/event-tasks-api")>(
    "../lib/event-tasks-api",
  );
  return {
    ...actual,
    fetchEventTasks: vi.fn(),
    createEventTask: vi.fn(),
    updateEventTask: vi.fn(),
    deleteEventTask: vi.fn(),
  };
});

import {
  createEventTask,
  deleteEventTask,
  fetchEventTasks,
  updateEventTask,
} from "../lib/event-tasks-api";
import { EventTaskManager } from "./EventTaskManager";

const mockedFetch = vi.mocked(fetchEventTasks);
const mockedCreate = vi.mocked(createEventTask);
const mockedUpdate = vi.mocked(updateEventTask);
const mockedDelete = vi.mocked(deleteEventTask);

function makeTask(overrides: Partial<EventTaskResponse> = {}): EventTaskResponse {
  return {
    id: 1,
    event_id: 10,
    event_name: "Dashain",
    title: "Book the venue",
    description: "Reserve the hall",
    assignee_id: 2,
    assignee_name: "Board Member",
    status: "todo",
    due_date: null,
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
    ...overrides,
  };
}

const assignableMembers: MemberResponse[] = [
  {
    id: 2,
    full_name: "Board Member",
    email: "board@semo.edu",
    student_id: "87654321",
    major: "Admin",
    graduation_year: 2028,
    role: "board",
    status: "approved",
    position: "member",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventTaskManager", () => {
  it("renders existing tasks with assignee and status", async () => {
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });

    render(
      <EventTaskManager
        eventId={10}
        canManage={false}
        assignableMembers={assignableMembers}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );
    expect(screen.getByText("Assigned to Board Member")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add task" }),
    ).not.toBeInTheDocument();
  });

  it("creates a task when a manager submits the form", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [], total: 0 });
    mockedCreate.mockResolvedValue(makeTask({ title: "Print flyers" }));

    render(
      <EventTaskManager
        eventId={10}
        canManage
        assignableMembers={assignableMembers}
      />,
    );

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Task"), "Print flyers");
    await user.selectOptions(screen.getByLabelText("Assign to"), "2");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ title: "Print flyers", assignee_id: 2 }),
    );
    expect(await screen.findByText("Print flyers")).toBeInTheDocument();
  });

  it("changes a task status", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });
    mockedUpdate.mockResolvedValue(makeTask({ status: "done" }));

    render(
      <EventTaskManager
        eventId={10}
        canManage
        assignableMembers={assignableMembers}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText(/Status/), "done");

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(1, { status: "done" }),
    );
  });

  it("deletes a task after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });
    mockedDelete.mockResolvedValue();

    render(
      <EventTaskManager
        eventId={10}
        canManage
        assignableMembers={assignableMembers}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(screen.queryByText("Book the venue")).not.toBeInTheDocument(),
    );
  });
});
