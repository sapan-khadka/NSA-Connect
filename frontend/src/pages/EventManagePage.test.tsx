import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockEventResponse } from "../test/test-utils";
import { EventManagePage } from "./EventManagePage";

vi.mock("../components/EventTaskManager", () => ({
  EventTaskManager: () => <div data-testid="event-task-manager">Tasks</div>,
}));

vi.mock("../components/FinanceEntryList", () => ({
  FinanceEntryList: () => (
    <div data-testid="finance-entry-list">Transactions</div>
  ),
}));

vi.mock("../components/EventInvitedParticipantsSection", () => ({
  EventInvitedParticipantsSection: () => (
    <div data-testid="event-invited-participants">Invited participants</div>
  ),
}));

vi.mock("../lib/events-api", () => ({
  fetchEvent: vi.fn(),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn(),
}));

vi.mock("../lib/finance-api", () => ({
  fetchEventBudgetForEvent: vi.fn(),
}));

vi.mock("../lib/members-api", () => ({
  fetchAssignableMembers: vi.fn(),
}));

vi.mock("../components/MeetingRecordSection", () => ({
  MeetingRecordSection: () => (
    <div data-testid="meeting-record-section">Meeting record</div>
  ),
}));

const mockEvent = {
  ...createMockEventResponse({
    id: 1,
    name: "Dashain Celebration",
    budget: "500.00",
    current_member_rsvp_status: null,
    show_in_photo_archive: true,
  }),
  prep_tasks: [],
};

function renderPage(role: "board" | "treasurer" = "board") {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "Board User",
          email: "board@semo.edu",
          student_id: "11223344",
          major: "CS",
          graduation_year: 2027,
          role,
          status: "approved",
          position: "member",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={["/events/1/manage"]}>
        <Routes>
          <Route path="/events/:eventId/manage" element={<EventManagePage />} />
        </Routes>
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("EventManagePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows event details, task completion, and budget for board", async () => {
    const { fetchEvent } = await import("../lib/events-api");
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    const { fetchEventBudgetForEvent } = await import("../lib/finance-api");

    vi.mocked(fetchEvent).mockResolvedValue(mockEvent);
    vi.mocked(fetchEventTasks).mockResolvedValue({
      tasks: [
        {
          id: 1,
          event_id: 1,
          event_name: "Dashain Celebration",
          task_kind: "simple",
          title: "Setup",
          group_name: null,
          description: "",
          status: "done",
          assignee_id: 2,
          assignee_name: "Alex",
          due_date: null,
          is_overdue: false,
          is_complete: true,
          checklist_items: [],
          completion_note: null,
          completion_photo_url: null,
          completed_at: "2030-05-02T12:00:00Z",
          created_by_id: 1,
          created_at: "2030-05-01T12:00:00Z",
        },
        {
          id: 2,
          event_id: 1,
          event_name: "Dashain Celebration",
          task_kind: "simple",
          title: "Cleanup",
          group_name: null,
          description: "",
          status: "in_progress",
          assignee_id: 3,
          assignee_name: "Sam",
          due_date: null,
          is_overdue: false,
          is_complete: false,
          checklist_items: [],
          completion_note: null,
          completion_photo_url: null,
          completed_at: null,
          created_by_id: 1,
          created_at: "2030-05-01T12:00:00Z",
        },
      ],
      total: 2,
    });
    vi.mocked(fetchEventBudgetForEvent).mockResolvedValue({
      event_id: 1,
      event_name: "Dashain Celebration",
      planned_budget: "500.00",
      actual_expense: "120.00",
      actual_income: "80.00",
      budget_remaining: "380.00",
      over_budget: false,
      entry_count: 2,
    });

    renderPage("board");

    expect(await screen.findByText("Dashain Celebration")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Show in photo archive/i }),
    ).toBeChecked();
    expect(screen.queryByRole("button", { name: "Meeting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logistics" })).not.toBeInTheDocument();
    expect(screen.getByText("Task completion")).toBeInTheDocument();
    expect(screen.getByText("1/2 done (50%)")).toBeInTheDocument();
    expect(screen.getByText("Event budget")).toBeInTheDocument();
    expect(screen.getByTestId("event-task-manager")).toBeInTheDocument();
    expect(screen.queryByTestId("finance-entry-list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete event" }),
    ).toBeInTheDocument();
  });

  it("shows meeting tools on the Meeting tab for meeting events", async () => {
    const user = userEvent.setup();
    const { fetchEvent } = await import("../lib/events-api");
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    const { fetchEventBudgetForEvent } = await import("../lib/finance-api");

    vi.mocked(fetchEvent).mockResolvedValue({
      ...mockEvent,
      event_type: "meeting",
      name: "March Board Meeting",
    });
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });
    vi.mocked(fetchEventBudgetForEvent).mockResolvedValue({
      event_id: 1,
      event_name: "March Board Meeting",
      planned_budget: "0.00",
      actual_expense: "0.00",
      actual_income: "0.00",
      budget_remaining: "0.00",
      over_budget: false,
      entry_count: 0,
    });

    renderPage("board");

    expect(await screen.findByTestId("meeting-record-section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meeting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logistics" })).toBeInTheDocument();
    expect(screen.queryByText("Task completion")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logistics" }));

    expect(await screen.findByText("Task completion")).toBeInTheDocument();
    expect(screen.queryByTestId("meeting-record-section")).not.toBeInTheDocument();
  });

  it("does not show meeting tabs for non-meeting events", async () => {
    const { fetchEvent } = await import("../lib/events-api");
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    const { fetchEventBudgetForEvent } = await import("../lib/finance-api");

    vi.mocked(fetchEvent).mockResolvedValue(mockEvent);
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });
    vi.mocked(fetchEventBudgetForEvent).mockResolvedValue({
      event_id: 1,
      event_name: "Dashain Celebration",
      planned_budget: "500.00",
      actual_expense: "0.00",
      actual_income: "0.00",
      budget_remaining: "500.00",
      over_budget: false,
      entry_count: 0,
    });

    renderPage("board");

    expect(await screen.findByText("Task completion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Meeting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logistics" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("meeting-record-section")).not.toBeInTheDocument();
  });

  it("shows finance entries for treasurer", async () => {
    const { fetchEvent } = await import("../lib/events-api");
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    const { fetchEventBudgetForEvent } = await import("../lib/finance-api");

    vi.mocked(fetchEvent).mockResolvedValue(mockEvent);
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });
    vi.mocked(fetchEventBudgetForEvent).mockResolvedValue({
      event_id: 1,
      event_name: "Dashain Celebration",
      planned_budget: "500.00",
      actual_expense: "0.00",
      actual_income: "0.00",
      budget_remaining: "500.00",
      over_budget: false,
      entry_count: 0,
    });

    renderPage("treasurer");

    await waitFor(() =>
      expect(screen.getByTestId("finance-entry-list")).toBeInTheDocument(),
    );
  });
});
