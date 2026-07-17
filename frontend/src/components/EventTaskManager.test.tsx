import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";

vi.mock("../lib/event-tasks-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/event-tasks-api")>(
    "../lib/event-tasks-api",
  );
  return {
    ...actual,
    fetchEventTasks: vi.fn(),
    fetchMyEventTasks: vi.fn(),
    createEventTask: vi.fn(),
    updateEventTask: vi.fn(),
    deleteEventTask: vi.fn(),
    updateEventTaskChecklistItem: vi.fn(),
  };
});

vi.mock("../lib/members-api", () => ({
  fetchAssignableMembers: vi.fn().mockResolvedValue({ members: [], total: 0 }),
}));

import {
  createEventTask,
  deleteEventTask,
  fetchEventTasks,
  fetchMyEventTasks,
  updateEventTask,
} from "../lib/event-tasks-api";
import { fetchAssignableMembers } from "../lib/members-api";
import { EventTaskManager } from "./EventTaskManager";

const mockedFetch = vi.mocked(fetchEventTasks);
const mockedFetchMine = vi.mocked(fetchMyEventTasks);
const mockedCreate = vi.mocked(createEventTask);
const mockedUpdate = vi.mocked(updateEventTask);
const mockedDelete = vi.mocked(deleteEventTask);
const mockedFetchAssignees = vi.mocked(fetchAssignableMembers);

const boardMember: MemberResponse = {
  id: 1,
  full_name: "Board User",
  email: "board@semo.edu",
  student_id: "87654321",
  major: "Admin",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "member",
};

const generalMember: MemberResponse = {
  id: 6,
  full_name: "apsana",
  email: "apsana@semo.edu",
  student_id: "12345678",
  major: "CS",
  graduation_year: 2028,
  role: "general",
  status: "approved",
  position: "member",
};

function makeTask(overrides: Partial<EventTaskResponse> = {}): EventTaskResponse {
  return {
    id: 1,
    event_id: 10,
    event_name: "Dashain",
    task_kind: "simple",
    title: "Book the venue",
    group_name: null,
    description: "Reserve the hall",
    assignee_id: 2,
    assignee_name: "Board Member",
    status: "todo",
    due_date: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
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

function renderManager(overrides: Partial<Parameters<typeof EventTaskManager>[0]> = {}) {
  return render(
    <EventTaskManager
      eventId={10}
      eventName="Dashain"
      member={boardMember}
      canManageSimple={false}
      canAssignChecklist={false}
      assignableMembers={assignableMembers}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventTaskManager", () => {
  beforeEach(() => {
    mockedFetchAssignees.mockResolvedValue({
      members: assignableMembers,
      total: assignableMembers.length,
    });
  });

  it("renders existing tasks with assignee and status", async () => {
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });

    renderManager();

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );
    expect(screen.getByText("Board Member")).toBeInTheDocument();
    expect(screen.getByText("0/1 done")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add task" }),
    ).not.toBeInTheDocument();
  });

  it("shows assigned simple tasks for a general member", async () => {
    mockedFetchMine.mockResolvedValue({
      tasks: [
        makeTask({
          id: 21,
          event_id: 10,
          title: "Help with tihar",
          status: "in_progress",
          assignee_id: 6,
          assignee_name: "apsana",
        }),
      ],
      total: 1,
    });

    renderManager({ member: generalMember });

    await waitFor(() => expect(mockedFetchMine).toHaveBeenCalled());
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(await screen.findByText("Help with tihar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In progress" })).toBeInTheDocument();
  });

  it("opens the add form pre-filled from a volunteer task draft", async () => {
    mockedFetch.mockResolvedValue({ tasks: [], total: 0 });

    renderManager({
      canManageSimple: true,
      taskDraft: {
        title: "Help with tihar",
        description: "i can help with the decoration.",
        assigneeId: 6,
        assigneeName: "apsana",
      },
      onTaskDraftApplied: vi.fn(),
    });

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());

    expect(screen.getByLabelText("Title")).toHaveValue("Help with tihar");
    expect(screen.getByLabelText(/Details/)).toHaveValue(
      "i can help with the decoration.",
    );
    expect(screen.getByLabelText("Assign to")).toHaveValue("6");
    expect(screen.getByRole("option", { name: "apsana" })).toBeInTheDocument();
  });

  it("creates a task when a manager submits the form", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [], total: 0 });
    mockedCreate.mockResolvedValue(makeTask({ title: "Print flyers" }));

    renderManager({ canManageSimple: true });

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockedFetchAssignees).toHaveBeenCalledWith("all_approved"),
    );

    await user.click(screen.getByRole("button", { name: "+ Add task" }));
    await user.type(screen.getByLabelText("Title"), "Print flyers");
    await user.selectOptions(screen.getByLabelText("Assign to"), "2");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ title: "Print flyers", assignee_id: 2 }),
    );
    expect(await screen.findByText("Print flyers")).toBeInTheDocument();
  });

  it("changes a task status from the status pill menu", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });
    mockedUpdate.mockResolvedValue(makeTask({ status: "done" }));

    renderManager({ canManageSimple: true });

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "To do" }));
    await user.click(screen.getByRole("menuitem", { name: "Done" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(1, { status: "done" }),
    );
  });

  it("deletes a task after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });
    mockedDelete.mockResolvedValue();

    renderManager({ canManageSimple: true });

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: "Delete task Book the venue" }),
    );

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(screen.queryByText("Book the venue")).not.toBeInTheDocument(),
    );
  });

  it("hides add task controls after the event has ended", async () => {
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });

    renderManager({ canManageSimple: true, canCreateTasks: false });

    await waitFor(() =>
      expect(screen.getByText("Book the venue")).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("button", { name: "+ Add task" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("This event has ended — new tasks can't be added."),
    ).toBeInTheDocument();
  });
});
