import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockMember } from "../test/test-utils";
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

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedMyTasks = vi.mocked(fetchMyEventTasks);
const mockedPendingMembers = vi.mocked(fetchPendingMembers);
const mockedFinancePending = vi.mocked(fetchPendingFinanceChangeRequests);

const sampleEvent = {
  id: 5,
  name: "Dashain Celebration",
  starts_at: "2030-06-01T18:00:00+00:00",
  event_type: "cultural" as const,
  description: "Annual cultural celebration",
  budget: "500.00",
  created_by_id: 1,
  rsvp_count: 12,
  current_member_has_rsvped: false,
};

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
    expect(screen.getByText("Quick links")).toBeInTheDocument();
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
      expect(screen.getByText("Your work")).toBeInTheDocument(),
    );

    expect(screen.queryByLabelText("Needs attention")).not.toBeInTheDocument();
  });
});
