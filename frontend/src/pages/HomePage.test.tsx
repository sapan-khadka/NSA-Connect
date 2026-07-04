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
  };
});

vi.mock("../lib/recent-memories", () => ({
  fetchRecentMemories: vi.fn(),
}));

import { fetchMyEventTasks } from "../lib/event-tasks-api";
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

  it("shows a compact member dashboard with activity and role tools", async () => {
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
        name: /Welcome back,/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Test User")).toHaveClass("text-foreground");
    expect(
      screen.getByRole("navigation", { name: "Finance quick actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Log transaction" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review approvals/ })).toHaveAttribute(
      "href",
      "/finance?tab=approvals",
    );

    expect(await screen.findByLabelText("Activity")).toBeInTheDocument();
    expect(screen.getByText("1 assigned task past due")).toBeInTheDocument();
    expect(screen.getByText("2 member signups waiting for approval")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Review ›/ })).toHaveLength(2);

    expect(screen.getByText("Your work")).toBeInTheDocument();
    expect(screen.getByText("Print flyers")).toBeInTheDocument();

    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Dashain Celebration" }),
    ).toHaveAttribute("href", "/events/5");
    expect(screen.getByRole("link", { name: /Full calendar/ })).toHaveAttribute(
      "href",
      "/events/calendar",
    );

    expect(screen.getByText("Next board meeting")).toBeInTheDocument();
    expect(screen.getByText("March Board Meeting")).toBeInTheDocument();
    expect(screen.getByText("2 going · 7 not yet responded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View ›" })).toHaveAttribute(
      "href",
      "/events/meetings/9",
    );

    expect(screen.getByText("More for your role")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Past events/i })).toHaveAttribute(
      "href",
      "/events/past",
    );
    expect(screen.getByRole("link", { name: /Task oversight/i })).toHaveAttribute(
      "href",
      "/events/oversight",
    );
  });

  it("hides board meeting card for general members", async () => {
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
      expect(screen.getByText("Assigned work")).toBeInTheDocument(),
    );

    expect(screen.queryByText("Next board meeting")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Finance quick actions" }),
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
      await screen.findByRole("link", { name: "Dashain Celebration" }),
    ).toBeInTheDocument();
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
      expect(screen.getByText("Your work")).toBeInTheDocument(),
    );

    const overdueTile = screen.getByText("Overdue").closest(".ds-stat-tile");
    expect(overdueTile).not.toBeNull();
    expect(within(overdueTile as HTMLElement).getByText("0")).toHaveClass(
      "ds-stat-value",
    );
    expect(screen.queryByText("0", { selector: ".ds-stat-overdue-chip" })).not.toBeInTheDocument();
  });

  it("limits activity height when many items are present", async () => {
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
    mockedPendingMembers.mockResolvedValue({ members: [], total: 3 });
    mockedFinancePending.mockResolvedValue({ requests: [], total: 2 });
    mockedMyFinanceSummary.mockResolvedValue({
      pending_count: 1,
      recently_rejected_count: 1,
      recently_approved_count: 1,
    });
    mockedMeetings.mockResolvedValue({ meetings: [], total: 0 });

    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: createMockMember("treasurer") }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    const activityList = await screen.findByLabelText("Activity");
    expect(activityList.querySelector("ul")).toHaveClass("max-h-64", "overflow-y-auto");
    expect(screen.getAllByText("Recent · clears from this feed after 7 days")).toHaveLength(2);

    const activityItems = Array.from(
      activityList.querySelectorAll("li p.text-sm"),
    ).map((node) => node.textContent);
    expect(activityItems[0]).toContain("assigned task");
    expect(activityItems.at(-1)).toContain("approved this week");
  });

  it("shows an activity empty state when counts are zero", async () => {
    mockedUpcoming.mockResolvedValue({ events: [], total: 0 });
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
      expect(screen.getByText("Assigned work")).toBeInTheDocument(),
    );

    expect(screen.getByText("No open tasks assigned")).toBeInTheDocument();
    expect(screen.getByLabelText("Activity")).toBeInTheDocument();
    expect(screen.getByText("All caught up")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing needs your attention right now."),
    ).toBeInTheDocument();
  });

  it("shows recent memories near the bottom when an album has photos", async () => {
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

    expect(await screen.findByText("Recent memories")).toBeInTheDocument();
    expect(screen.getByText("From Dashain · 5 photos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all photos ›" })).toHaveAttribute(
      "href",
      "/events/photos",
    );
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
      await screen.findByRole("button", { name: "+ Log transaction" }),
    );

    expect(screen.getByRole("dialog", { name: "Log transaction" })).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });
});
