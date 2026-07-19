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
}));

vi.mock("../lib/finance-api", () => ({
  fetchFinanceSummary: vi.fn().mockResolvedValue({
    balance: "1000.00",
    total_income: "0",
    total_expense: "0",
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

vi.mock("../lib/announcements-api", () => ({
  fetchAnnouncements: vi.fn().mockResolvedValue({ announcements: [], total: 0 }),
  ANNOUNCEMENT_CATEGORY_LABELS: {
    general: "General",
    event: "Event",
    finance: "Finance",
    other: "Other",
  },
}));

vi.mock("../lib/meetings-api", () => ({
  fetchMeetings: vi.fn().mockResolvedValue({ meetings: [], total: 0 }),
}));

vi.mock("../lib/recent-memories", () => ({
  fetchRecentMemories: vi.fn().mockResolvedValue({ album: null, photos: [], extraPhotoCount: 0 }),
}));

import { fetchUpcomingEvents } from "../lib/events-api";
import { fetchMyEventTasks, updateEventTask, fetchTaskOverview } from "../lib/event-tasks-api";
import { fetchPendingFinanceChangeRequests } from "../lib/finance-api";
import { fetchPendingMembers } from "../lib/members-api";

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedMyTasks = vi.mocked(fetchMyEventTasks);
const mockedUpdateTask = vi.mocked(updateEventTask);
const mockedTaskOverview = vi.mocked(fetchTaskOverview);
const mockedPendingMembers = vi.mocked(fetchPendingMembers);
const mockedFinancePending = vi.mocked(fetchPendingFinanceChangeRequests);

const sampleEvent = createMockEventResponse({
  id: 5,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  location: "Student Center",
});

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 0 });
    mockedTaskOverview.mockResolvedValue({
      members: [],
      total_tasks: 0,
      completed_tasks: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard hierarchy matching the command center", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedTaskOverview.mockResolvedValue({
      members: [
        {
          member_id: 99,
          full_name: "Asha Thapa",
          role: "general",
          position: "member",
          total: 2,
          completed: 0,
          in_progress: 0,
          todo: 2,
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
            },
          ],
        },
      ],
      total_tasks: 2,
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
      await screen.findByRole("heading", {
        name: /Good (Morning|Afternoon|Evening), Test/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Here's what's happening with NSA today/i),
    ).toBeInTheDocument();

    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("Active Tasks")).toBeInTheDocument();
    expect(screen.getByText("Active Members")).toBeInTheDocument();
    expect(screen.getByText("Budget Balance")).toBeInTheDocument();

    expect(screen.getByLabelText("Featured Event")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Workspace/i })).toHaveAttribute(
      "href",
      "/events/5",
    );
    expect(screen.getByRole("link", { name: /Manage Event/i })).toHaveAttribute(
      "href",
      "/events/5/manage",
    );
    const oversight = await screen.findByLabelText("Task Oversight");
    expect(
      within(oversight).getByText("Dashain Celebration"),
    ).toBeInTheDocument();
    expect(within(oversight).getByText("1 overdue")).toBeInTheDocument();
    expect(
      within(oversight).getByRole("link", { name: /Dashain Celebration/i }),
    ).toHaveAttribute("href", "/events/oversight?event=5");
    expect(
      within(oversight).getByRole("link", { name: /View all/i }),
    ).toHaveAttribute("href", "/events/oversight");
    expect(screen.queryByText("My Tasks")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Today's Timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("CampusOS AI")).toBeInTheDocument();
    expect(screen.getByLabelText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByLabelText("Upcoming Deadlines")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization Health")).toBeInTheDocument();

    expect(screen.queryByLabelText("Board Feed")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your Workspaces")).not.toBeInTheDocument();
  });

  it("shows create-style quick actions for board", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const quickActions = await screen.findByLabelText("Quick Actions");
    expect(
      within(quickActions).getByRole("link", { name: /New Event/i }),
    ).toHaveAttribute("href", "/events/calendar?create=1");
    expect(
      within(quickActions).getByRole("link", { name: /Meeting Minutes/i }),
    ).toHaveAttribute("href", "/board/meeting-minutes");
    expect(
      within(quickActions).getByRole("link", { name: /Invite Member/i }),
    ).toHaveAttribute("href", "/members");
  });

  it("surfaces pending reviews in My Tasks for board without oversight", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 2 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 1 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("treasurer") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", { name: /2 member approvals pending/i }),
    ).toHaveAttribute("href", "/members?tab=pending");
    expect(
      screen.getByRole("link", { name: /1 finance review required/i }),
    ).toHaveAttribute("href", "/finance?tab=approvals");
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    expect(screen.queryByLabelText("Task Oversight")).not.toBeInTheDocument();
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
    expect(
      within(featured).getByRole("link", { name: /Open Workspace/i }),
    ).toHaveAttribute("href", "/events/9");
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
    expect(screen.queryByLabelText("CampusOS AI")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Manage Event/i })).not.toBeInTheDocument();
    const quickActions = screen.getByLabelText("Quick Actions");
    expect(
      within(quickActions).queryByRole("link", { name: /New Event/i }),
    ).not.toBeInTheDocument();
    expect(
      within(quickActions).getByRole("link", { name: /New Task/i }),
    ).toBeInTheDocument();
  });

  it("renders CampusOS AI suggestions", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("board") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const ai = await screen.findByLabelText("CampusOS AI");
    expect(within(ai).getByText("Draft announcement")).toBeInTheDocument();
    expect(within(ai).getByPlaceholderText("Ask anything…")).toBeInTheDocument();
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
    expect(screen.getByText("You're clear for now")).toBeInTheDocument();
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
