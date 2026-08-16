import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EventOverviewCard,
  formatEventCountdown,
} from "./EventOverviewCard";
import {
  createMockEventDetailResponse,
  createMockEventResponse,
  createMockMember,
  MockAuthProvider,
} from "../test/test-utils";

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    fetchEventAttendees: vi.fn().mockResolvedValue({
      going_count: 3,
      maybe_count: 0,
      not_going_count: 0,
      attendees: [
        {
          member_id: 10,
          full_name: "Ada Lovelace",
          rsvp_status: "going",
        },
        {
          member_id: 11,
          full_name: "Grace Hopper",
          rsvp_status: "going",
        },
        {
          member_id: 12,
          full_name: "Alan Turing",
          rsvp_status: "going",
        },
      ],
    }),
    fetchEventVolunteerSignups: vi.fn().mockResolvedValue({
      signups: [],
    }),
    fetchEventVolunteerSlots: vi.fn().mockResolvedValue({
      slots: [],
      total: 0,
    }),
  };
});

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn().mockResolvedValue({
    tasks: [
      { id: 1, status: "done" },
      { id: 2, status: "todo" },
      { id: 3, status: "done" },
    ],
  }),
}));

vi.mock("../lib/finance-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/finance-api")>(
    "../lib/finance-api",
  );
  return {
    ...actual,
    fetchEventBudgetForEvent: vi.fn().mockResolvedValue({
      planned_budget: "300",
      actual_expense: "100",
      budget_remaining: "200",
    }),
  };
});

const dayEvent = createMockEventResponse({
  id: 7,
  name: "Spring Festival",
  starts_at: "2030-08-01T18:00:00+00:00",
  location: "Union Hall",
  description: "A short description.",
});

const eventDetail = createMockEventDetailResponse({
  ...dayEvent,
  current_member_rsvp_status: null,
});

describe("formatEventCountdown", () => {
  it("formats whole days remaining", () => {
    const now = new Date("2030-07-14T18:00:00+00:00");
    expect(formatEventCountdown("2030-08-01T18:00:00+00:00", now)).toBe(
      "18 days left",
    );
  });

  it("returns null for past events", () => {
    const now = new Date("2030-08-02T12:00:00+00:00");
    expect(formatEventCountdown("2030-08-01T18:00:00+00:00", now)).toBeNull();
  });
});

describe("EventOverviewCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders details, progress, and actions from real data", async () => {
    render(
      <MockAuthProvider
        value={{
          member: createMockMember("board"),
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <EventOverviewCard
            selectedDate="2030-08-01"
            dayEvents={[dayEvent]}
            selectedEventId={7}
            onSelectEvent={vi.fn()}
            eventDetail={eventDetail}
            detailLoading={false}
            detailError={null}
            rsvpLoading={false}
            onRsvpStatusChange={vi.fn()}
          />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(screen.getByText("Spring Festival")).toBeInTheDocument();
    expect(screen.getByLabelText("Date, time, and location")).toHaveTextContent(
      "Union Hall",
    );
    expect(screen.queryByText(/organizer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/committee/i)).not.toBeInTheDocument();

    expect(await screen.findByLabelText("Event status")).toBeInTheDocument();
    expect(screen.queryByText("Prep")).not.toBeInTheDocument();
    expect(screen.queryByText("67%")).not.toBeInTheDocument();
    expect(screen.getByText("$300")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Volunteers")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Set volunteer targets")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/events/7/manage?tab=operations",
    );

    expect(screen.getByRole("link", { name: "Open event" })).toHaveAttribute(
      "href",
      "/events/7",
    );
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      "/events/7/manage",
    );

    expect(
      await screen.findByRole("button", { name: /View attendees/i }),
    ).toBeInTheDocument();
  });

  it("keeps fixed content order for every event", async () => {
    render(
      <MockAuthProvider
        value={{
          member: createMockMember("board"),
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <EventOverviewCard
            selectedDate="2030-08-01"
            dayEvents={[dayEvent]}
            selectedEventId={7}
            onSelectEvent={vi.fn()}
            eventDetail={eventDetail}
            detailLoading={false}
            detailError={null}
            rsvpLoading={false}
            onRsvpStatusChange={vi.fn()}
          />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    const title = await screen.findByRole("heading", { name: "Spring Festival" });
    const meta = screen.getByLabelText("Date, time, and location");
    const category = screen.getByText("Cultural");
    const rsvp = screen.getByLabelText("Your RSVP");
    const health = await screen.findByLabelText("Event status");
    const attendees = screen.getByTestId("event-attendees-row");

    const order = [title, meta, category, rsvp, health, attendees];

    for (let index = 1; index < order.length; index += 1) {
      expect(
        order[index - 1]!.compareDocumentPosition(order[index]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("lets each segmented RSVP option fire the shared handler", async () => {
    const user = userEvent.setup();
    const onRsvpStatusChange = vi.fn();

    render(
      <MockAuthProvider
        value={{
          member: createMockMember("general"),
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <EventOverviewCard
            selectedDate="2030-08-01"
            dayEvents={[dayEvent]}
            selectedEventId={7}
            onSelectEvent={vi.fn()}
            eventDetail={eventDetail}
            detailLoading={false}
            detailError={null}
            rsvpLoading={false}
            onRsvpStatusChange={onRsvpStatusChange}
          />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: /^Going$/i }));
    expect(onRsvpStatusChange).toHaveBeenCalledWith("going");

    await user.click(screen.getByRole("button", { name: /^Maybe$/i }));
    expect(onRsvpStatusChange).toHaveBeenCalledWith("maybe");

    await user.click(screen.getByRole("button", { name: /^Can't Go$/i }));
    expect(onRsvpStatusChange).toHaveBeenCalledWith("not_going");
  });
});
