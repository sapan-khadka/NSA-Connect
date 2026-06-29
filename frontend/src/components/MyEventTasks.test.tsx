import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EventTaskResponse } from "../lib/event-tasks-api";

vi.mock("../lib/event-tasks-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/event-tasks-api")>(
    "../lib/event-tasks-api",
  );
  return {
    ...actual,
    fetchMyEventTasks: vi.fn(),
    updateEventTask: vi.fn(),
    uploadTaskPhoto: vi.fn(),
  };
});

import {
  fetchMyEventTasks,
  updateEventTask,
  uploadTaskPhoto,
} from "../lib/event-tasks-api";
import { MyEventTasks } from "./MyEventTasks";

const mockedFetch = vi.mocked(fetchMyEventTasks);
const mockedUpdate = vi.mocked(updateEventTask);
const mockedUpload = vi.mocked(uploadTaskPhoto);

function makeTask(overrides: Partial<EventTaskResponse> = {}): EventTaskResponse {
  return {
    id: 7,
    event_id: 10,
    event_name: "Dashain",
    task_kind: "simple",
    title: "Decorate hall",
    group_name: null,
    description: "",
    assignee_id: 1,
    assignee_name: "Test User",
    status: "todo",
    due_date: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: 2,
    created_at: "2026-03-18T12:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MyEventTasks", () => {
  it("shows an empty state when no tasks are assigned", async () => {
    mockedFetch.mockResolvedValue({ tasks: [], total: 0 });

    render(<MyEventTasks />);

    await waitFor(() =>
      expect(
        screen.getByText("No tasks assigned to you."),
      ).toBeInTheDocument(),
    );
  });

  it("saves a completion note", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });
    mockedUpdate.mockResolvedValue(makeTask({ completion_note: "All done" }));

    render(<MyEventTasks />);

    await waitFor(() =>
      expect(screen.getByText("Decorate hall")).toBeInTheDocument(),
    );

    await user.type(
      screen.getByLabelText(/Completion note/),
      "All done",
    );
    await user.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(7, {
        completion_note: "All done",
      }),
    );
  });

  it("uploads a completion photo and links it to the task", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ tasks: [makeTask()], total: 1 });
    mockedUpload.mockResolvedValue("https://cdn.example.com/photo.jpg");
    mockedUpdate.mockResolvedValue(
      makeTask({ completion_photo_url: "https://cdn.example.com/photo.jpg" }),
    );

    render(<MyEventTasks />);

    await waitFor(() =>
      expect(screen.getByText("Decorate hall")).toBeInTheDocument(),
    );

    const file = new File(["bytes"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/Completion photo/), file);

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledWith(file));
    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(7, {
        completion_photo_url: "https://cdn.example.com/photo.jpg",
      }),
    );
  });
});
