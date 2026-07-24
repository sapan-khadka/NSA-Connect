import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "./HomePage";
import {
  MockAuthProvider,
  createMockEventResponse,
  createMockMember,
} from "../test/test-utils";

vi.mock("../lib/events-api", () => ({
  fetchUpcomingEvents: vi.fn(),
  fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  updateEventRsvp: vi.fn(),
  fetchEventAttendees: vi.fn().mockResolvedValue({
    going_count: 2,
    maybe_count: 1,
    not_going_count: 0,
    no_response_count: 3,
    attendees: [],
  }),
  fetchEventVolunteerSignups: vi.fn().mockResolvedValue({
    signups: [],
    total: 4,
  }),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchMyEventTasks: vi.fn(),
  fetchEventTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
  updateEventTask: vi.fn(),
  fetchTaskOverview: vi.fn().mockResolvedValue({
    members: [],
    total_tasks: 0,
    completed_tasks: 0,
  }),
}));

vi.mock("../lib/members-api", () => ({
  fetchMembers: vi.fn().mockResolvedValue({ members: [], total: 12 }),
  fetchPendingMembers: vi.fn(),
  fetchMemberActivity: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock("../context/NotificationSummaryProvider", () => ({
  useNotificationSummary: vi.fn(),
  NavCountBadge: () => null,
}));

vi.mock("../lib/finance-api", () => ({
  fetchFinanceSummary: vi.fn().mockResolvedValue({
    balance: "1000.00",
    total_income: "0",
    total_expense: "0",
  }),
  fetchEventBudgetForEvent: vi.fn().mockResolvedValue({
    event_id: 5,
    event_name: "Dashain Celebration",
    planned_budget: "500.00",
    actual_expense: "120.00",
    actual_income: "0",
    budget_remaining: "380.00",
    over_budget: false,
    entry_count: 1,
  }),
  fetchPendingFinanceChangeRequests: vi.fn(),
  fetchMyFinanceChangeRequestSummary: vi.fn().mockResolvedValue({
    pending_count: 0,
    recently_rejected_count: 0,
    recently_approved_count: 0,
  }),
  createFinanceEntry: vi.fn(),
}));

vi.mock("../lib/discussion-api", () => ({
  fetchDiscussionInbox: vi.fn().mockResolvedValue({ rooms: [] }),
  toggleDiscussionRoomPin: vi.fn(),
}));

vi.mock("../lib/meetings-api", () => ({
  fetchMeetings: vi.fn().mockResolvedValue({ meetings: [], total: 0 }),
}));

import { fetchUpcomingEvents } from "../lib/events-api";
import {
  fetchMyEventTasks,
  updateEventTask,
  fetchTaskOverview,
} from "../lib/event-tasks-api";
import { fetchDiscussionInbox } from "../lib/discussion-api";
import { fetchMeetings } from "../lib/meetings-api";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { EMPTY_INBOX, EMPTY_NOTIFICATION_SUMMARY } from "../lib/notifications-api";

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedMyTasks = vi.mocked(fetchMyEventTasks);
const mockedUpdateTask = vi.mocked(updateEventTask);
const mockedTaskOverview = vi.mocked(fetchTaskOverview);
const mockedDiscussions = vi.mocked(fetchDiscussionInbox);
const mockedMeetings = vi.mocked(fetchMeetings);
const mockedNotificationSummary = vi.mocked(useNotificationSummary);

function mockSummary(overrides: Partial<typeof EMPTY_NOTIFICATION_SUMMARY> = {}) {
  mockedNotificationSummary.mockReturnValue({
    summary: { ...EMPTY_NOTIFICATION_SUMMARY, ...overrides },
    inbox: EMPTY_INBOX,
    loading: false,
    refresh: () => undefined,
    menuItems: [],
    unreadCount: 0,
    markRead: async () => undefined,
    markAllRead: async () => undefined,
  });
}

const sampleEvent = createMockEventResponse({
  id: 5,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  location: "Student Center",
});

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSummary();
    mockedTaskOverview.mockResolvedValue({
      members: [],
      total_tasks: 0,
      completed_tasks: 0,
    });
    mockedDiscussions.mockResolvedValue({ rooms: [] });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the calm SaaS home hierarchy for President", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedTaskOverview.mockResolvedValue({
      members: [
        {
          member_id: 99,
          full_name: "Asha Thapa",
          role: "general",
          position: "member",
          total: 1,
          completed: 0,
          in_progress: 0,
          todo: 1,
          completion_percent: 0,
          tasks: [
            {
              id: 1,
              event_id: 5,
              event_name: "Dashain Celebration",
              task_kind: "simple",
              title: "Print flyers",
              group_name: null,
              description: "",
              assignee_id: 99,
              assignee_name: "Asha Thapa",
              status: "todo",
              due_date: "2030-05-20T12:00:00+00:00",
              is_overdue: true,
              is_complete: false,
              checklist_items: [],
              completion_note: null,
              completion_photo_url: null,
              completed_at: null,
              created_by_id: 2,
              created_at: "2030-05-01T12:00:00+00:00",
              assignee_has_volunteer_signup: false,
            },
          ],
        },
      ],
      total_tasks: 1,
      completed_tasks: 0,
    });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("heading", {
        name: /Good (Morning|Afternoon|Evening), Test/i,
      }),
    ).not.toBeInTheDocument();

    expect(screen.queryByText("Active Tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs Review")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Needs attention")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Quick stats")).toBeInTheDocument();
    expect(screen.getByLabelText("Quick actions")).toBeInTheDocument();
    expect(screen.getByLabelText("Recent activity")).toBeInTheDocument();
    expect(screen.getByLabelText("Task summary")).toBeInTheDocument();
    expect(screen.queryByLabelText("Today at a glance")).not.toBeInTheDocument();

    const featured = screen.getByLabelText("Featured Event");
    expect(
      within(featured).getByRole("heading", { name: "Dashain Celebration" }),
    ).toBeInTheDocument();
    expect(
      within(featured).getByRole("link", { name: /Open event/i }),
    ).toHaveAttribute("href", "/events/5");
    expect(within(featured).getByText(/Going/i)).toBeInTheDocument();
    expect(within(featured).getByText(/Maybe/i)).toBeInTheDocument();
    expect(within(featured).getByText(/^RSVP$/i)).toBeInTheDocument();
    expect(within(featured).getByText(/Budget/i)).toBeInTheDocument();
    expect(within(featured).queryByText("Preparation")).not.toBeInTheDocument();
    expect(
      within(featured).queryByText("Confirmed attendance"),
    ).not.toBeInTheDocument();

    expect(screen.queryByLabelText("Action Center")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Meeting Minutes")).not.toBeInTheDocument();

    const work = await screen.findByLabelText("Work Center");
    expect(within(work).getByLabelText("My Tasks")).toBeInTheDocument();
    expect(await within(work).findByLabelText("Task Oversight")).toBeInTheDocument();
    expect(await within(work).findByText("Print flyers")).toBeInTheDocument();
    expect(await within(work).findByText("Your tasks")).toBeInTheDocument();

    expect(screen.queryByLabelText("Today's Timeline")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Organization Health")).not.toBeInTheDocument();

    expect(await screen.findByLabelText("Discussions")).toBeInTheDocument();
  });

  it("surfaces overdue task counts in My tasks tabs", async () => {
    const overdueTask = {
      id: 1,
      event_id: 5,
      event_name: "Dashain Celebration",
      task_kind: "simple" as const,
      title: "Late flyer",
      group_name: null,
      description: "",
      assignee_id: 1,
      assignee_name: "Test User",
      status: "todo" as const,
      due_date: "2020-01-01T12:00:00+00:00",
      is_overdue: true,
      is_complete: false,
      checklist_items: [],
      completion_note: null,
      completion_photo_url: null,
      completed_at: null,
      created_by_id: 2,
      created_at: "2020-01-01T12:00:00+00:00",
      assignee_has_volunteer_signup: false,
    };
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [overdueTask], total: 1 });
    mockSummary({ members_pending: 2 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const summary = await screen.findByLabelText("Task summary");
    expect(within(summary).getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByLabelText("Quick actions")).toBeInTheDocument();
  });

  it("shows personal My tasks and Task Oversight for President", async () => {
    const openTask = {
      id: 1,
      event_id: 5,
      event_name: "Dashain Celebration",
      task_kind: "simple" as const,
      title: "Book venue",
      group_name: null,
      description: "",
      assignee_id: 1,
      assignee_name: "Test User",
      status: "todo" as const,
      due_date: "2030-05-20T12:00:00+00:00",
      is_overdue: false,
      is_complete: false,
      checklist_items: [],
      completion_note: null,
      completion_photo_url: null,
      completed_at: null,
      created_by_id: 2,
      created_at: "2030-05-01T12:00:00+00:00",
      assignee_has_volunteer_signup: false,
    };
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [openTask], total: 1 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const work = await screen.findByLabelText("Work Center");
    expect(await within(work).findByText("Book venue")).toBeInTheDocument();
    expect(within(work).getByLabelText("Task Oversight")).toBeInTheDocument();
    expect(within(work).queryByText("High")).not.toBeInTheDocument();
  });

  it("shows finance and member quick actions for treasurer", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockSummary({ members_pending: 2, finance_pending: 1 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("treasurer") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const actions = await screen.findByLabelText("Quick actions");
    expect(within(actions).getByRole("link", { name: /Add Expense/i })).toBeInTheDocument();
    expect(within(actions).getByRole("link", { name: /Add Member/i })).toBeInTheDocument();
    expect(within(actions).getByRole("link", { name: /Post Announcement/i })).toBeInTheDocument();
    expect(screen.getByLabelText("My Tasks")).toBeInTheDocument();
    expect(screen.queryByLabelText("Action Center")).not.toBeInTheDocument();
  });

  it("shows create event quick action for board members", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("board") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const actions = await screen.findByLabelText("Quick actions");
    expect(
      within(actions).getByRole("link", { name: /Create Event/i }),
    ).toHaveAttribute("href", "/events/calendar?create=1");
    expect(
      within(actions).getByRole("link", { name: /Post Announcement/i }),
    ).toBeInTheDocument();
  });

  it("cycles featured upcoming events with carousel controls", async () => {
    const user = userEvent.setup();
    const secondEvent = createMockEventResponse({
      id: 9,
      name: "Holi Night",
      starts_at: "2030-07-01T18:00:00+00:00",
    });
    mockedUpcoming.mockResolvedValue({
      events: [sampleEvent, secondEvent],
      total: 2,
    });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const featured = await screen.findByLabelText("Featured Event");
    expect(
      within(featured).getByRole("heading", { name: "Dashain Celebration" }),
    ).toBeInTheDocument();

    await user.click(
      within(featured).getAllByRole("button", {
        name: /Next upcoming event/i,
      })[0]!,
    );

    expect(
      await within(featured).findByRole("heading", { name: "Holi Night" }),
    ).toBeInTheDocument();
  });

  it("hides board-only affordances for general members", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("general") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await screen.findByLabelText("Featured Event");
    expect(screen.queryByRole("link", { name: /^Manage$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Action Center")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Discussions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Meeting Minutes")).not.toBeInTheDocument();
  });

  it.each([
    ["president", "president"] as const,
    ["board", "vice_president"] as const,
    ["board", "secretary"] as const,
    ["treasurer", "treasurer"] as const,
    ["board", "event_manager"] as const,
    ["board", "public_relations_officer"] as const,
    ["board", "new_student_representative"] as const,
  ])(
    "shows board Home collaboration for %s / %s",
    async (role, position) => {
      mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
      mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

      render(
        <MemoryRouter>
          <MockAuthProvider
            value={{
              member: createMockMember(role, { position }),
            }}
          >
            <HomePage />
          </MockAuthProvider>
        </MemoryRouter>,
      );

      expect(await screen.findByLabelText("Discussions")).toBeInTheDocument();
      expect(screen.queryByLabelText("Meeting Minutes")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Action Center")).not.toBeInTheDocument();
    },
  );

  it("shows board Home collaboration for custom board position holders", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider
          value={{
            member: createMockMember("board", {
              position: "member",
              custom_board_position: {
                id: 7,
                name: "Cultural Lead",
                is_active: true,
              },
            }),
          }}
        >
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Discussions")).toBeInTheDocument();
    expect(screen.queryByLabelText("Meeting Minutes")).not.toBeInTheDocument();
  });

  it("shows View calendar empty state for general members with no events", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("general") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const featured = await screen.findByLabelText("Featured Event");
    expect(
      within(featured).getByRole("link", { name: /View calendar/i }),
    ).toHaveAttribute("href", "/events/calendar");
  });

  it("keeps meeting-only days off the featured carousel", async () => {
    const now = new Date();
    const todayIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      15,
      0,
      0,
    ).toISOString();
    const todayMeeting = createMockEventResponse({
      id: 42,
      name: "Board Sync",
      event_type: "meeting",
      starts_at: todayIso,
    });
    mockedUpcoming.mockResolvedValue({
      events: [sampleEvent, todayMeeting],
      total: 2,
    });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("board") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Today's Timeline")).not.toBeInTheDocument();
    const featured = await screen.findByLabelText("Featured Event");
    expect(within(featured).getByText(sampleEvent.name)).toBeInTheDocument();
    expect(within(featured).queryByText("Board Sync")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Discussions")).toBeInTheDocument();
    expect(screen.getByLabelText("Quick stats")).toBeInTheDocument();
    expect(screen.getByLabelText("Quick actions")).toBeInTheDocument();
  });

  it("marks a simple My Tasks row complete via status done", async () => {
    const user = userEvent.setup();
    const openTask = {
      id: 1,
      event_id: 5,
      event_name: "Dashain Celebration",
      task_kind: "simple" as const,
      title: "Book venue",
      group_name: null,
      description: "",
      assignee_id: 1,
      assignee_name: "Board User",
      status: "todo" as const,
      due_date: "2030-05-20T12:00:00+00:00",
      is_overdue: false,
      is_complete: false,
      checklist_items: [],
      completion_note: null,
      completion_photo_url: null,
      completed_at: null,
      created_by_id: 2,
      created_at: "2030-05-01T12:00:00+00:00",
      assignee_has_volunteer_signup: false,
    };
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [openTask], total: 1 });
    mockedUpdateTask.mockResolvedValue({
      ...openTask,
      status: "done",
      is_complete: true,
      completed_at: "2030-05-10T12:00:00+00:00",
    });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("board") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Book venue")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Mark Book venue complete" }),
    );

    await waitFor(() => {
      expect(mockedUpdateTask).toHaveBeenCalledWith(1, { status: "done" });
    });
    await waitFor(() => {
      expect(screen.queryByText("Book venue")).not.toBeInTheDocument();
    });
    expect(screen.getByText("You're clear")).toBeInTheDocument();
  });

  it("rolls back and shows an error when completing a task fails", async () => {
    const user = userEvent.setup();
    const openTask = {
      id: 1,
      event_id: 5,
      event_name: "Dashain Celebration",
      task_kind: "simple" as const,
      title: "Book venue",
      group_name: null,
      description: "",
      assignee_id: 1,
      assignee_name: "Board User",
      status: "todo" as const,
      due_date: null,
      is_overdue: false,
      is_complete: false,
      checklist_items: [],
      completion_note: null,
      completion_photo_url: null,
      completed_at: null,
      created_by_id: 2,
      created_at: "2030-05-01T12:00:00+00:00",
      assignee_has_volunteer_signup: false,
    };
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [openTask], total: 1 });
    mockedUpdateTask.mockRejectedValue(new Error("Network down"));

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("board") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Book venue")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Mark Book venue complete" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByText("Book venue")).toBeInTheDocument();
  });

  it("shows the public landing when logged out", () => {
    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: null, isAuthenticated: false }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
