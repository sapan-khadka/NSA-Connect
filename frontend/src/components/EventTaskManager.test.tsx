import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
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
    saveEventTaskChecklist: vi.fn(),
  };
});

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    addPrepTaskToEvent: vi.fn(),
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
  saveEventTaskChecklist,
  updateEventTask,
} from "../lib/event-tasks-api";
import { addPrepTaskToEvent } from "../lib/events-api";
import { fetchAssignableMembers } from "../lib/members-api";
import { EventTaskManager } from "./EventTaskManager";

const mockedFetch = vi.mocked(fetchEventTasks);
const mockedFetchMine = vi.mocked(fetchMyEventTasks);
const mockedCreate = vi.mocked(createEventTask);
const mockedUpdate = vi.mocked(updateEventTask);
const mockedDelete = vi.mocked(deleteEventTask);
const mockedSaveChecklist = vi.mocked(saveEventTaskChecklist);
const mockedAddChecklist = vi.mocked(addPrepTaskToEvent);
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
      screen.queryByRole("button", { name: "New task" }),
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

    await user.click(screen.getByRole("button", { name: "New task" }));
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
      screen.queryByRole("button", { name: "New task" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New checklist" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("This event has ended. New tasks can't be added."),
    ).toBeInTheDocument();
  });

  function makeChecklist(
    overrides: Partial<EventTaskResponse> = {},
  ): EventTaskResponse {
    return makeTask({
      id: 40,
      task_kind: "checklist",
      title: "Setup",
      group_name: "Setup",
      description: "",
      assignee_id: 2,
      assignee_name: "Board Member",
      due_date: "2030-05-20T12:00:00Z",
      checklist_items: [
        { id: 7, label: "Reserve room", is_completed: true, sort_order: 0 },
        { id: 8, label: "Test AV", is_completed: false, sort_order: 1 },
      ],
      ...overrides,
    });
  }

  it("saves renamed, reordered, and edited checklist items", async () => {
    const user = userEvent.setup();
    const checklist = makeChecklist();
    mockedFetch.mockResolvedValue({ tasks: [checklist], total: 1 });
    mockedSaveChecklist.mockImplementation(async (_taskId, draft) =>
      makeChecklist({
        title: draft.title,
        group_name: draft.title,
        checklist_items: draft.items.map((item, index) => ({
          id: item.id ?? 90 + index,
          label: item.label,
          is_completed: item.id === 7,
          sort_order: index,
        })),
      }),
    );

    renderManager({ eventStartsAt: "2030-06-01T18:00:00Z" });

    expect(await screen.findByRole("button", { name: "Edit checklist" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete checklist" })).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Task progress" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );

    await user.click(screen.getByRole("button", { name: "Edit checklist" }));
    const room = screen.getByDisplayValue("Reserve room");
    expect(room.closest("div")?.className).toContain("flex-col");
    expect(room.closest("div")?.className).toContain("sm:flex-row");

    await user.clear(screen.getByLabelText("Category name"));
    await user.type(screen.getByLabelText("Category name"), "Venue");
    await user.clear(room);
    await user.type(screen.getByLabelText("Checklist item 1"), "Book the auditorium");
    await user.click(screen.getByRole("button", { name: "Move item 2 up" }));
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByLabelText("Checklist item 3"), "Print signs");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockedSaveChecklist).toHaveBeenCalledTimes(1));
    expect(mockedSaveChecklist).toHaveBeenCalledWith(40, {
      title: "Venue",
      items: [
        { id: 8, label: "Test AV" },
        { id: 7, label: "Book the auditorium" },
        { id: null, label: "Print signs" },
      ],
    });
    expect(await screen.findByRole("heading", { name: "Venue" })).toBeInTheDocument();
    expect(screen.getByText("Book the auditorium")).toBeInTheDocument();
    expect(screen.getByText(/Due /)).toBeInTheDocument();
    expect(screen.getByText(/Board Member/)).toBeInTheDocument();
  });

  it("updates progress while items are added or removed", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeChecklist()], total: 1 });

    renderManager();
    await user.click(await screen.findByRole("button", { name: "Edit checklist" }));
    await user.click(screen.getByRole("button", { name: "Remove item 2" }));

    expect(screen.getByRole("progressbar", { name: "Task progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByRole("progressbar", { name: "Overall task progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("asks before deleting a completed checklist item", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockedFetch.mockResolvedValue({ tasks: [makeChecklist()], total: 1 });

    renderManager();
    await user.click(await screen.findByRole("button", { name: "Edit checklist" }));
    await user.click(screen.getByRole("button", { name: "Remove item 1" }));

    expect(confirm).toHaveBeenCalledWith('Delete the completed item "Reserve room"?');
    expect(screen.getByDisplayValue("Reserve room")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("keeps checklist edits on screen when saving fails", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeChecklist()], total: 1 });
    mockedSaveChecklist.mockRejectedValue(
      new AxiosError("fail", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 422,
        statusText: "Unprocessable",
        headers: {},
        config: { headers: {} as never },
        data: { detail: "Checklist item not found" },
      }),
    );

    renderManager();
    await user.click(await screen.findByRole("button", { name: "Edit checklist" }));
    await user.clear(screen.getByLabelText("Checklist item 2"));
    await user.type(screen.getByLabelText("Checklist item 2"), "Check microphones");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Checklist item not found",
    );
    expect(screen.getByDisplayValue("Check microphones")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("cancels checklist editing without saving", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeChecklist()], total: 1 });

    renderManager();
    await user.click(await screen.findByRole("button", { name: "Edit checklist" }));
    await user.clear(screen.getByLabelText("Category name"));
    await user.type(screen.getByLabelText("Category name"), "Venue");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedSaveChecklist).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Setup" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Venue")).not.toBeInTheDocument();
  });

  it("creates a checklist category for an existing event", async () => {
    const user = userEvent.setup();
    mockedFetch
      .mockResolvedValueOnce({ tasks: [], total: 0 })
      .mockResolvedValueOnce({ tasks: [makeChecklist({ title: "Publicity", group_name: "Publicity" })], total: 1 });
    mockedAddChecklist.mockResolvedValue({
      id: 40,
      group_name: "Publicity",
      due_date: "2030-05-18T17:00:00Z",
      assignee_id: null,
      is_overdue: false,
      is_complete: false,
      checklist_items: [],
    });

    renderManager({ eventStartsAt: "2030-06-01T18:00:00Z" });
    await user.click(await screen.findByRole("button", { name: "New checklist" }));
    await user.type(screen.getByLabelText("Category name"), "Publicity");
    await user.type(screen.getByLabelText("New checklist item 1"), "Design the poster");
    await user.click(screen.getByRole("button", { name: "Save checklist" }));

    await waitFor(() => expect(mockedAddChecklist).toHaveBeenCalledTimes(1));
    expect(mockedAddChecklist).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        group_name: "Publicity",
        checklist_items: ["Design the poster"],
      }),
    );
    expect(await screen.findByRole("heading", { name: "Publicity" })).toBeInTheDocument();
  });

  it("deletes a checklist category after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedFetch.mockResolvedValue({ tasks: [makeChecklist()], total: 1 });
    mockedDelete.mockResolvedValue();

    renderManager({ canManageSimple: true });
    await user.click(await screen.findByRole("button", { name: "Delete checklist" }));

    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(40));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Setup" })).not.toBeInTheDocument(),
    );
    confirm.mockRestore();
  });

  it("hides checklist editing from members who cannot manage structure", async () => {
    mockedFetchMine.mockResolvedValue({
      tasks: [makeChecklist({ assignee_id: 6, assignee_name: "apsana" })],
      total: 1,
    });

    renderManager({ member: generalMember });

    expect(await screen.findByText("Reserve room")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit checklist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete checklist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New checklist" })).not.toBeInTheDocument();
  });
});
