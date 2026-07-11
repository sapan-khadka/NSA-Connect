import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockEventResponse, createMockMember } from "../test/test-utils";
import { HomePage } from "./HomePage";

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    fetchUpcomingEvents: vi.fn(),
    fetchEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    fetchEventAttendees: vi.fn(),
    updateEventRsvp: vi.fn(),
    rsvpToEvent: vi.fn(),
    cancelEventRsvp: vi.fn(),
  };
});

vi.mock("../lib/event-tasks-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/event-tasks-api")>(
    "../lib/event-tasks-api",
  );
  return {
    ...actual,
    fetchMyEventTasks: vi.fn(),
  };
});

vi.mock("../lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/members-api")>(
    "../lib/members-api",
  );
  return {
    ...actual,
    fetchPendingMembers: vi.fn(),
    fetchMembers: vi.fn().mockResolvedValue({
      members: [],
      total: 128,
      page: 1,
      page_size: 1,
      total_pages: 128,
    }),
  };
});

vi.mock("../lib/meetings-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/meetings-api")>(
    "../lib/meetings-api",
  );
  return {
    ...actual,
    fetchMeetings: vi.fn(),
  };
});

vi.mock("../lib/finance-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/finance-api")>(
    "../lib/finance-api",
  );
  return {
    ...actual,
    fetchPendingFinanceChangeRequests: vi.fn(),
    fetchMyFinanceChangeRequestSummary: vi.fn(),
    fetchFinanceSummary: vi.fn().mockResolvedValue({
      balance: "910.00",
      total_income: "1000.00",
      total_expense: "90.00",
      entry_count: 2,
      pre_event: { income: "0", expense: "0", balance: "0", entry_count: 0 },
      events: [],
    }),
  };
});

vi.mock("../lib/discussion-api", () => ({
  fetchBoardDiscussion: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
  postBoardDiscussion: vi.fn(),
  fetchEventDiscussion: vi.fn(),
  postEventDiscussion: vi.fn(),
}));

vi.mock("../lib/recent-memories", () => ({
  fetchRecentMemories: vi.fn(),
}));

import { fetchMyEventTasks } from "../lib/event-tasks-api";
import { fetchBoardDiscussion } from "../lib/discussion-api";
import { fetchEventAttendees, fetchUpcomingEvents } from "../lib/events-api";
import {
  fetchMyFinanceChangeRequestSummary,
  fetchPendingFinanceChangeRequests,
} from "../lib/finance-api";
import { fetchPendingMembers } from "../lib/members-api";
import { fetchMeetings } from "../lib/meetings-api";
import { fetchRecentMemories } from "../lib/recent-memories";

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedEventAttendees = vi.mocked(fetchEventAttendees);
const mockedMyTasks = vi.mocked(fetchMyEventTasks);
const mockedPendingMembers = vi.mocked(fetchPendingMembers);
const mockedFinancePending = vi.mocked(fetchPendingFinanceChangeRequests);
const mockedMyFinanceSummary = vi.mocked(fetchMyFinanceChangeRequestSummary);
const mockedMeetings = vi.mocked(fetchMeetings);
const mockedRecentMemories = vi.mocked(fetchRecentMemories);
const mockedBoardDiscussion = vi.mocked(fetchBoardDiscussion);

const sampleEvent = createMockEventResponse({
  id: 5,
  name: "Dashain Celebration",
  event_type: "cultural",
  current_member_rsvp_status: "going",
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockedRecentMemories.mockResolvedValue(null);
  mockedBoardDiscussion.mockResolvedValue({ messages: [], total: 0 });
});

describe("HomePage", () => {
  it("shows a public landing page with login and registration only", () => {
    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: null, isAuthenticated: false, token: null }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("img", {
        name: "Nepalese Students Association at SEMO",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "NSA Connect" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByText("Upcoming events")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse events" })).not.toBeInTheDocument();
    expect(mockedUpcoming).not.toHaveBeenCalled();
  });

  it("shows a compact member dashboard with Your Work and role tools", async () => {
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
    mockedPendingMembers.mockResolvedValue({ members: [], total: 2 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 0 });
    mockedMyFinanceSummary.mockResolvedValue({
      pending_count: 0,
      recently_rejected_count: 0,
      recently_approved_count: 0,
    });
    mockedMeetings.mockResolvedValue({
      meetings: [
        {
          event_id: 9,
          event_name: "March Board Meeting",
          starts_at: "2030-07-01T18:00:00+00:00",
          is_past: false,
          agenda: "Budget review",
          has_attendance: false,
          has_minutes: false,
          has_summary: false,
          present_count: 0,
          absent_count: 0,
          excused_count: 0,
          unmarked_count: 0,
          minutes_updated_at: null,
        },
      ],
      total: 1,
    });
    mockedEventAttendees.mockResolvedValue({
      going_count: 2,
      maybe_count: 1,
      not_going_count: 0,
      no_response_count: 7,
      attendees: [],
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
        name: /Welcome back, Test/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Log transaction/i }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Your Work")).toBeInTheDocument();
    expect(screen.getByText("Discussion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start a discussion/i })).toHaveAttribute(
      "href",
      "/board/discussion",
    );
    expect(screen.getByText("Print flyers")).toBeInTheDocument();
    expect(screen.getByText(/Overdue: Print flyers/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("1 assigned task past due")).not.toBeInTheDocument();
    expect(screen.queryByText("Announcements")).not.toBeInTheDocument();

    expect(
      screen.getAllByRole("link", { name: "Dashain Celebration" })[0],
    ).toHaveAttribute("href", "/events/5");
    expect(screen.getByRole("link", { name: /View calendar/i })).toHaveAttribute(
      "href",
      "/events/calendar",
    );
    expect(screen.getByRole("link", { name: /^Manage$/i })).toHaveAttribute(
      "href",
      "/events/5/manage",
    );

    expect(screen.getByText("Tools for Your Role")).toBeInTheDocument();
    expect(screen.getByText("Your Profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit profile/i })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: /Past Events/i })).toHaveAttribute(
      "href",
      "/events/past",
    );
    expect(screen.getByRole("link", { name: /Task Oversight/i })).toHaveAttribute(
      "href",
      "/events/oversight",
    );
  });

  it("hides log transaction for general members", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("general") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Your Work")).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("button", { name: /Log transaction/i }),
    ).not.toBeInTheDocument();
    expect(mockedMeetings).not.toHaveBeenCalled();
  });

  it("skips meetings when choosing the up next event", async () => {
    mockedUpcoming.mockResolvedValue({
      events: [
        createMockEventResponse({
          id: 8,
          name: "April Board Meeting",
          event_type: "meeting",
        }),
        sampleEvent,
      ],
      total: 2,
    });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findAllByRole("link", { name: "Dashain Celebration" }),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "April Board Meeting" })).not.toBeInTheDocument();
  });

  it("uses neutral overdue styling when the overdue count is zero", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({
      tasks: [
        {
          id: 1,
          event_id: 5,
          event_name: "Dashain Celebration",
          task_kind: "simple",
          title: "On-time task",
          group_name: null,
          description: "",
          assignee_id: 1,
          assignee_name: "Board User",
          status: "todo",
          due_date: "2030-05-20T12:00:00+00:00",
          is_overdue: false,
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
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 0 });
    mockedMyFinanceSummary.mockResolvedValue({
      pending_count: 0,
      recently_rejected_count: 0,
      recently_approved_count: 0,
    });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("president") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Your Work")).toBeInTheDocument(),
    );

    const overdueTile = screen.getByText("Overdue").closest("div.rounded-card");
    expect(overdueTile).not.toBeNull();
    expect(within(overdueTile as HTMLElement).getByText("0")).toHaveClass(
      "text-foreground",
    );
    expect(screen.queryByText("0", { selector: ".text-overdue" })).not.toBeInTheDocument();
  });

  it("shows overdue task name in Your Work", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({
      tasks: [
        {
          id: 1,
          event_id: 5,
          event_name: "Dashain Celebration",
          task_kind: "simple",
          title: "Late task",
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
    mockedFinancePending.mockResolvedValue({ requests: [], total: 2 });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("treasurer") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Your Work")).toBeInTheDocument(),
    );

    expect(screen.getByText(/Overdue: Late task/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Activity")).not.toBeInTheDocument();
  });

  it("shows Your Work empty state when counts are zero", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("general") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Your Work")).toBeInTheDocument(),
    );

    expect(screen.getAllByText("Open Tasks").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Overdue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Next Due")).toBeInTheDocument();
    expect(screen.getByText("No upcoming due dates")).toBeInTheDocument();
    expect(screen.queryByLabelText("Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });
  it("keeps profile on the dashboard bottom row", async () => {
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });
    mockedRecentMemories.mockResolvedValue({
      album: {
        event_id: 7,
        event_name: "Dashain",
        starts_at: "2026-10-01T18:00:00Z",
        event_type: "cultural",
        photo_count: 5,
        cover_thumbnail_url: "https://example.com/cover.jpg",
      },
      photos: [
        {
          id: 1,
          event_id: 7,
          uploaded_by_id: 1,
          uploaded_by_name: "Member",
          image_url: "https://example.com/1.jpg",
          thumbnail_url: "https://example.com/1-thumb.jpg",
          created_at: "2026-10-02T12:00:00Z",
          can_delete: false,
        },
      ],
      extraPhotoCount: 1,
    });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("general") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Your Profile")).toBeInTheDocument();
    expect(screen.queryByText("Recent memories")).not.toBeInTheDocument();
  });

  it("opens the log transaction modal for treasurer users", async () => {
    const user = userEvent.setup();
    mockedUpcoming.mockResolvedValue({ events: [sampleEvent], total: 1 });
    mockedMyTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockedPendingMembers.mockResolvedValue({ members: [], total: 0 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 1 });
    mockedMyFinanceSummary.mockResolvedValue({
      pending_count: 0,
      recently_rejected_count: 0,
      recently_approved_count: 0,
    });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("treasurer") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: /Log transaction/i }),
    );

    expect(screen.getByRole("dialog", { name: "Log transaction" })).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });
});
