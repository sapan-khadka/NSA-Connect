import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockEventDetailResponse } from "../test/test-utils";
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

vi.mock("../components/EventCheckInPanel", () => ({
  EventCheckInPanel: () => <div data-testid="event-checkin-panel">Check-in</div>,
}));

vi.mock("../components/EventAttendanceSummaryPanel", () => ({
  EventAttendanceSummaryPanel: () => (
    <div data-testid="event-attendance-summary">Attendance summary</div>
  ),
}));

vi.mock("../lib/events-api", () => ({
  fetchEvent: vi.fn(),
  fetchEventVolunteerSignups: vi.fn().mockResolvedValue({ total: 0, signups: [] }),
  fetchEventInvitedParticipants: vi.fn().mockResolvedValue({ invitations: [] }),
  fetchEventAttendees: vi.fn().mockResolvedValue({
    going_count: 84,
    maybe_count: 0,
    not_going_count: 0,
    no_response_count: 0,
    attendees: [],
  }),
  patchEvent: vi.fn(),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn(),
}));

vi.mock("../lib/event-checkin-api", () => ({
  fetchEventAttendanceSummary: vi.fn().mockResolvedValue(null),
  fetchEventCheckIns: vi.fn().mockResolvedValue({ checkins: [] }),
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

vi.mock("../components/EventVolunteersSection", () => ({
  EventVolunteersSection: () => (
    <div data-testid="event-volunteers-section">Volunteers</div>
  ),
}));

const mockEvent = createMockEventDetailResponse({
  id: 1,
  name: "Dashain Celebration",
  budget: "500.00",
  current_member_rsvp_status: null,
  show_in_photo_archive: true,
});

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

async function mockBoardEventLoad(overrides: Partial<typeof mockEvent> = {}) {
  const { fetchEvent } = await import("../lib/events-api");
  const { fetchEventTasks } = await import("../lib/event-tasks-api");
  const { fetchEventBudgetForEvent } = await import("../lib/finance-api");

  vi.mocked(fetchEvent).mockResolvedValue({ ...mockEvent, ...overrides });
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
    event_name: overrides.name ?? "Dashain Celebration",
    planned_budget: "500.00",
    actual_expense: "120.00",
    actual_income: "80.00",
    budget_remaining: "380.00",
    over_budget: false,
    entry_count: 2,
  });
}

describe("EventManagePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a Home-style card grid with schedule and photo on the page", async () => {
    await mockBoardEventLoad();
    renderPage("board");

    expect(await screen.findByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Events/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Event" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Public Page" })).toHaveAttribute(
      "href",
      "/events/1",
    );
    expect(screen.getByRole("button", { name: "Share Event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check In" })).toBeInTheDocument();
    expect(screen.getByText("Attendees")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event photo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Check-in" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Show in photo archive/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Delete event" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Overview" })).not.toBeInTheDocument();

    const backLink = screen.getByRole("link", { name: /Back to Events/i });
    expect(backLink.getAttribute("href")).toMatch(
      /^\/events\/calendar\?date=\d{4}-\d{2}-\d{2}&event=1$/,
    );
  });

  it("opens the tasks modal from View all tasks", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByText("Dashain Celebration");
    expect(screen.getByText(/1\/2 done · 50%/)).toBeInTheDocument();
    expect(screen.getByText("Cleanup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /View all tasks/i }));
    expect(screen.getByTestId("event-task-manager")).toBeInTheDocument();
  });

  it("opens transactions modal for treasurer", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });

    renderPage("treasurer");

    await screen.findByText("Dashain Celebration");
    await user.click(screen.getByRole("button", { name: /View transactions/i }));

    await waitFor(() =>
      expect(screen.getByTestId("finance-entry-list")).toBeInTheDocument(),
    );
  });

  it("opens check-in and attendance detail modals", async () => {
    const user = userEvent.setup();
    const { fetchEventAttendanceSummary } = await import(
      "../lib/event-checkin-api"
    );
    vi.mocked(fetchEventAttendanceSummary).mockResolvedValue({
      event_id: 1,
      event_name: "Dashain Celebration",
      going_attended: { count: 4, members: [] },
      going_no_show: { count: 2, members: [] },
      walk_ins: { count: 1, members: [] },
      not_going: { count: 3, members: [] },
      guests_checked_in: { count: 0 },
    });

    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByText("Dashain Celebration");
    await user.click(screen.getByRole("button", { name: "Show check-in QR" }));
    expect(screen.getByTestId("event-checkin-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(
      screen.getAllByRole("button", { name: /View details/i })[1],
    );
    expect(screen.getByTestId("event-attendance-summary")).toBeInTheDocument();
  });

  it("shows meeting record card for meeting events", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad({
      event_type: "meeting",
      name: "March Board Meeting",
    });
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });

    renderPage("board");

    expect(await screen.findByRole("heading", { name: "Meeting record" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^View all$/i }));
    expect(screen.getByTestId("meeting-record-section")).toBeInTheDocument();
  });
});
