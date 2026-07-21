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

  it("renders a tabbed manage workspace with overview snapshot tiles", async () => {
    await mockBoardEventLoad();
    renderPage("board");

    expect(
      await screen.findByRole("heading", { name: "Dashain Celebration" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Events/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Event" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Public Page" })).toHaveAttribute(
      "href",
      "/e/1",
    );
    expect(
      screen.getByRole("button", { name: "Share Public Link" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check In" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate Event" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Attendees")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ops" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Record" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Event Readiness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve Issues" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event snapshot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Attending/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volunteers/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Budget left/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Checked in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Invited/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Share & announce/i }),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("Volunteers")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Budget")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check-in" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Event Communications")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Event Activity Timeline")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Event Details" })).not.toBeInTheDocument();

    const backLink = screen.getByRole("link", { name: /Back to Events/i });
    expect(backLink.getAttribute("href")).toMatch(
      /^\/events\/calendar\?date=\d{4}-\d{2}-\d{2}&event=1$/,
    );
  });

  it("opens details tab for editing core fields", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: "Edit Event" }));

    expect(await screen.findByRole("heading", { name: "Event Details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event name")).toBeInTheDocument();
    expect(screen.getByLabelText("Venue")).toBeInTheDocument();
    expect(screen.getByLabelText("Max attendees (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("About this event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Show in photo archive/i }),
    ).toBeChecked();
  });

  it("opens the tasks modal from overview open-tasks tile", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: /Open tasks/i }));
    expect(screen.getByTestId("event-task-manager")).toBeInTheDocument();
  });

  it("opens transactions modal for treasurer from overview budget tile", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    const { fetchEventTasks } = await import("../lib/event-tasks-api");
    vi.mocked(fetchEventTasks).mockResolvedValue({ tasks: [], total: 0 });

    renderPage("treasurer");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: /Budget left/i }));

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

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: /Checked in/i }));
    expect(screen.getByTestId("event-checkin-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByTestId("event-checkin-panel")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Check In" }));
    expect(screen.getByTestId("event-checkin-panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByTestId("event-checkin-panel")).not.toBeInTheDocument(),
    );

    await selectTab(user, "Overview");
    await user.click(screen.getByRole("button", { name: /Attending/i }));
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

    await screen.findByRole("heading", { name: "March Board Meeting" });
    await selectTab(user, "Record");
    expect(
      await screen.findByRole("heading", { name: "Meeting record" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Open meeting record/i }));
    expect(screen.getByTestId("meeting-record-section")).toBeInTheDocument();
  });

  it("lets board invite participants from the People tab", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await selectTab(user, "People");
    expect(
      await screen.findByRole("button", { name: "Invite members" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Add role" })).toBeInTheDocument();
    expect(screen.getByText("Going RSVPs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Invite members" }));
    expect(
      await screen.findByRole("heading", { name: "Invite participants" }),
    ).toBeInTheDocument();
  });

  it("opens real communications tools from the Record tab", async () => {
    const user = userEvent.setup();
    await mockBoardEventLoad();
    renderPage("board");

    await screen.findByRole("heading", { name: "Dashain Celebration" });
    await user.click(screen.getByRole("button", { name: /Share & announce/i }));
    expect(
      await screen.findByLabelText("Event Communications"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy public link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Compose update" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Reminders$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reminder now" }),
    ).toBeInTheDocument();
  });
});
