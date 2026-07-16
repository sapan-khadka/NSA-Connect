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
    going_count: 0,
    maybe_count: 0,
    not_going_count: 0,
    no_response_count: 0,
    attendees: [],
  }),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchMyEventTasks: vi.fn(),
  updateEventTask: vi.fn(),
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
import { fetchMyEventTasks, updateEventTask } from "../lib/event-tasks-api";
import { fetchPendingFinanceChangeRequests } from "../lib/finance-api";
import { fetchPendingMembers } from "../lib/members-api";
import { fetchDiscussionInbox } from "../lib/discussion-api";
import { fetchAnnouncements } from "../lib/announcements-api";

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedMyTasks = vi.mocked(fetchMyEventTasks);
const mockedUpdateTask = vi.mocked(updateEventTask);
const mockedPendingMembers = vi.mocked(fetchPendingMembers);
const mockedFinancePending = vi.mocked(fetchPendingFinanceChangeRequests);
const mockedDiscussionInbox = vi.mocked(fetchDiscussionInbox);
const mockedAnnouncements = vi.mocked(fetchAnnouncements);

const sampleEvent = createMockEventResponse({
  id: 5,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  location: "Student Center",
});

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDiscussionInbox.mockResolvedValue({ rooms: [] });
    mockedAnnouncements.mockResolvedValue({ announcements: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 0 });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the workspace command center hierarchy", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({
      tasks: [
        {
          id: 1,
          event_id: 5,
          event_name: "Dashain Celebration",
          task_kind: "simple",
          title: "Print flyers",
          group_name: null,
          description: "",
          assignee_id: 1,
          assignee_name: "Board User",
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
      total: 1,
    });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /Good (Morning|Afternoon|Evening), Test/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/President/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Your workspace for what needs attention/i),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Board Feed")).toBeInTheDocument();
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("CampusOS AI")).toBeInTheDocument();
    expect(screen.getByLabelText("Upcoming Event")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "View Event" })).toHaveAttribute(
      "href",
      "/events/5",
    );
    expect(screen.queryByRole("link", { name: /^Manage$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Going$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Maybe$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Not going$/i })).toBeInTheDocument();
    expect(screen.queryByText(/^DATE$/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming Event")).not.toBeInTheDocument();
    expect(screen.getByText("Student Center")).toBeInTheDocument();
    expect(screen.getByText("RSVP Open")).toBeInTheDocument();
    expect(screen.queryByText(/You're going/i)).not.toBeInTheDocument();

    expect(screen.getByText("Print flyers")).toBeInTheDocument();
    expect(screen.queryByText("Your Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Tools for Your Role")).not.toBeInTheDocument();
    expect(screen.queryByText("Quick actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Discussion")).not.toBeInTheDocument();
  });

  it("shows Create in the header menu destinations via empty task state copy", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("My Tasks")).toBeInTheDocument(),
    );

    expect(screen.getByText("You're clear for now")).toBeInTheDocument();
    expect(screen.queryByText("Create event")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Log transaction/i })).not.toBeInTheDocument();
  });

  it("surfaces pending reviews in My Tasks", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 2 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 1 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
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
  });

  it("hides board-only workspace affordances for general members", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("general") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await screen.findByLabelText("Upcoming Event");
    expect(screen.queryByRole("link", { name: /^Manage$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Going$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Maybe$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Not going$/i })).toBeInTheDocument();
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
