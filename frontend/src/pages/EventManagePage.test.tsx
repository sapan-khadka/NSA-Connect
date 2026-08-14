import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
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
  fetchEventVolunteerSlots: vi.fn().mockResolvedValue({ slots: [], total: 0 }),
  createEventVolunteerSlot: vi.fn(),
  duplicateEvent: vi.fn(),
  fetchEventInvitedParticipants: vi.fn().mockResolvedValue({ invitations: [] }),
  fetchEventAttendees: vi.fn().mockResolvedValue({
    going_count: 84,
    maybe_count: 0,
    not_going_count: 0,
    no_response_count: 0,
    attendees: [],
  }),
  patchEvent: vi.fn(),
  inviteEventParticipants: vi.fn(),
  fetchEventNotificationStatus: vi.fn().mockResolvedValue({
    event_id: 1,
    reminder_state: "scheduled",
    reminder_sent_count: 0,
    last_reminder_sent_at: null,
    nudge_state: "scheduled",
    nudge_sent_count: 0,
    hours_until_start: 72,
  }),
  sendEventRemindersNow: vi.fn(),
  fetchEventActivity: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  patchVolunteerSlot: vi.fn(),
  deleteVolunteerSlot: vi.fn(),
}));

vi.mock("../lib/announcements-api", () => ({
  ANNOUNCEMENT_AUDIENCE_LABELS: {
    all_approved: "All approved members",
    going: "Going RSVPs",
    maybe: "Maybe RSVPs",
    no_rsvp: "No RSVP yet",
  },
  fetchAnnouncements: vi.fn().mockResolvedValue({ announcements: [], total: 0 }),
  fetchAnnouncementRecipientPreview: vi.fn().mockResolvedValue({
    audience: "all_approved",
    event_id: 1,
    total: 10,
    emailable: 8,
  }),
  createAnnouncement: vi.fn(),
}));

vi.mock("../lib/ai-api", () => ({
  draftAnnouncementEmail: vi.fn(),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn(),
}));

vi.mock("../lib/event-checkin-api", () => ({
  fetchEventAttendanceSummary: vi.fn().mockResolvedValue(null),
  fetchEventCheckIns: vi.fn().mockResolvedValue({ checkins: [] }),
  fetchEventCheckInQr: vi.fn().mockResolvedValue({
    event_id: 1,
    event_name: "Dashain Celebration",
    checkin_url: "https://example.com/checkin/token",
    token: "token",
  }),
  regenerateEventCheckInQr: vi.fn().mockResolvedValue({
    event_id: 1,
    event_name: "Dashain Celebration",
    checkin_url: "https://example.com/checkin/token-new",
    token: "token-new",
  }),
}));

vi.mock("../lib/finance-api", () => ({
  fetchEventBudgetForEvent: vi.fn(),
}));

vi.mock("../lib/members-api", () => ({
  fetchAssignableMembers: vi.fn(),
  fetchMembers: vi.fn().mockResolvedValue({ members: [], total: 0 }),
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

async function selectTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("tab", { name }));
}

describe("EventManagePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a command-center overview instead of five equal tabs", async () => {
    await mockBoardEventLoad();
    renderPage("board");

    expect(
      await screen.findByRole("heading", { name: "Dashain Celebration" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Events/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check-in" })).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByTestId("event-command-metrics")).toBeInTheDocument();
    expect(
      screen.getByTestId("event-command-metrics"),
    ).toHaveTextContent("Attending");

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Attendees" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Record" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "People" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Ops" })).not.toBeInTheDocument();

    expect(screen.getByLabelText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View attendees" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View operations" })).not.toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Event Details" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Event Communications")).not.toBeInTheDocument();

    const backLink = screen.getByRole("link", { name: /Back to Events/i });
    expect(backLink.getAttribute("href")).toMatch(
      /^\/events\/calendar\?date=\d{4}-\d{2}-\d{2}&event=1$/,
    );
  });

  it("opens a drawer for editing core fields instead of a Details tab", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: "Edit event" }));

    expect(await screen.findByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event name")).toBeInTheDocument();
    expect(screen.getByLabelText("Venue")).toBeInTheDocument();
    expect(screen.getByLabelText("Max attendees (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("About this event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Show in Media/i }),
    ).toBeChecked();
  });

  it("opens the tasks modal from operations", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: "View task" }));
    expect(screen.getByTestId("event-task-manager")).toBeInTheDocument();
  });

  it("opens transactions modal for treasurer from operations budget", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });

    renderPage("treasurer");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("tab", { name: "Operations" }));
    await user.click(screen.getByRole("button", { name: "View transactions" }));

    await waitFor(() =>
      expect(screen.getByTestId("finance-entry-list")).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Open in Books" })).toHaveAttribute(
      "href",
      "/finance?tab=books&event_id=1",
    );
    expect(
      screen.getByRole("button", { name: "+ Log transaction" }),
    ).toBeInTheDocument();
  });

  it("opens check-in from the command header", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: "Check-in" }));
    expect(screen.getByTestId("event-checkin-panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByTestId("event-checkin-panel")).not.toBeInTheDocument(),
    );
  });

  it("shows meeting record tools on the Record workspace", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad({
      event_type: "meeting",
      name: "March Board Meeting",
    });
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });

    renderPage("board");

    await screen.findByRole("heading", { name: "March Board Meeting" });
    await selectTab(user, "Record");
    await user.click(screen.getByRole("button", { name: /Open meeting record/i }));
    expect(screen.getByTestId("meeting-record-section")).toBeInTheDocument();
  });

  it("lets board invite participants from the Attendees workspace", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await selectTab(user, "Attendees");
    expect(
      await screen.findByRole("button", { name: "Invite members" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Invite members" }));
    expect(
      await screen.findByRole("heading", { name: "Invite participants" }),
    ).toBeInTheDocument();
  });

  it("opens communications tools from the Record workspace", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await selectTab(user, "Record");
    expect(
      await screen.findByLabelText("Event Communications"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Compose update" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Reminders$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reminder now" }),
    ).toBeInTheDocument();
  });

  it("sends Add roles to Operations instead of the signups modal", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(await screen.findByRole("button", { name: "Add roles" }));

    expect(screen.getByRole("tab", { name: "Operations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByTestId("event-volunteers-section")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Role name")).toBeInTheDocument();
  });

  it("closes the editor after saving event details", async () => {
    const user = userEvent.setup();
    const { patchEvent } = await import("../lib/events-api");
    await mockBoardEventLoad();
    vi.mocked(patchEvent).mockResolvedValue({
      ...mockEvent,
      location: "Dempster Hall",
    });
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: "Edit event" }));
    expect(await screen.findByRole("heading", { name: "Edit event" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Venue"), "Dempster Hall");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Edit event" }),
      ).not.toBeInTheDocument(),
    );
  });
});
