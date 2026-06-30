import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockEventResponse, createMockMember } from "../test/test-utils";
import { HomePage } from "./HomePage";

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    fetchUpcomingEvents: vi.fn(),
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
  };
});

import { fetchMyEventTasks } from "../lib/event-tasks-api";
import { fetchUpcomingEvents } from "../lib/events-api";
import { fetchPendingFinanceChangeRequests } from "../lib/finance-api";
import { fetchPendingMembers } from "../lib/members-api";
import { fetchMeetings } from "../lib/meetings-api";

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedMyTasks = vi.mocked(fetchMyEventTasks);
const mockedPendingMembers = vi.mocked(fetchPendingMembers);
const mockedFinancePending = vi.mocked(fetchPendingFinanceChangeRequests);
const mockedMeetings = vi.mocked(fetchMeetings);

const sampleEvent = createMockEventResponse({
  id: 5,
  name: "Dashain Celebration",
  rsvp_count: 12,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

  it("shows a personalized member hub with tasks and alerts", async () => {
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
    mockedMeetings.mockResolvedValue({
      meetings: [
        {
          event_id: 9,
          event_name: "March Board Meeting",
          starts_at: "2030-05-01T18:00:00+00:00",
          is_past: true,
          agenda: "Budget review",
          has_attendance: true,
          has_minutes: true,
          has_summary: false,
          present_count: 5,
          absent_count: 1,
          excused_count: 0,
          unmarked_count: 0,
          minutes_updated_at: "2030-05-01T20:00:00+00:00",
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
      await screen.findByRole("heading", {
        name: /Welcome back, Test User/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Next event")).toBeInTheDocument();
    expect(screen.getAllByText("Dashain Celebration").length).toBeGreaterThan(0);
    expect(screen.getByText("Your work")).toBeInTheDocument();
    expect(screen.getByText("Print flyers")).toBeInTheDocument();
    expect(
      screen.getByText("2 member signups waiting for approval"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 assigned task overdue"),
    ).toBeInTheDocument();
    expect(screen.getByText("More for your role")).toBeInTheDocument();
    expect(screen.getByText("March Board Meeting")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View meeting/i })).toHaveAttribute(
      "href",
      "/events/meetings/9",
    );
    expect(screen.getByRole("link", { name: /My tasks/i })).toHaveAttribute(
      "href",
      "/events/tasks",
    );
    expect(screen.getByRole("link", { name: /Past events/i })).toHaveAttribute(
      "href",
      "/events/past",
    );
    expect(screen.getByRole("link", { name: /Task oversight/i })).toHaveAttribute(
      "href",
      "/events/oversight",
    );
  });

  it("does not show needs-attention alerts when counts are zero", async () => {
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

    expect(mockedMeetings).not.toHaveBeenCalled();

    expect(screen.queryByLabelText("Needs attention")).not.toBeInTheDocument();
  });
});
