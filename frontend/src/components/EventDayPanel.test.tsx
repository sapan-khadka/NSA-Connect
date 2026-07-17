import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventDayPanel, UpcomingEventsList } from "./EventDayPanel";
import type { EventDetailResponse, EventResponse } from "../lib/events-api";
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
      going_count: 0,
      maybe_count: 0,
      not_going_count: 0,
      attendees: [],
    }),
    fetchEventVolunteerSignups: vi.fn().mockResolvedValue({
      signups: [],
    }),
  };
});

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn().mockResolvedValue({ tasks: [] }),
}));

vi.mock("../lib/finance-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/finance-api")>(
    "../lib/finance-api",
  );
  return {
    ...actual,
    fetchEventBudgetForEvent: vi.fn().mockResolvedValue(null),
  };
});

const dayEvent: EventResponse = createMockEventResponse({
  id: 1,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  created_by_id: 2,
});

const eventDetail: EventDetailResponse = createMockEventDetailResponse({
  ...dayEvent,
});

const panelProps = {
  rsvpLoading: false,
  onRsvpStatusChange: vi.fn(),
};

function renderPanel(
  ui: ReactElement,
  role: "board" | "general" | null = null,
) {
  return render(
    <MockAuthProvider
      value={{
        member: role ? createMockMember(role) : null,
        isAuthenticated: role !== null,
      }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("UpcomingEventsList", () => {
  it("renders grouped upcoming events", () => {
    render(
      <UpcomingEventsList
        events={[dayEvent]}
        loading={false}
        onSelectEvent={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Dashain Celebration/i }),
    ).toBeInTheDocument();
  });
});

describe("EventDayPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Event details label for the default upcoming preview", async () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        showingDefaultUpcoming
        {...panelProps}
      />,
      "board",
    );

    expect(
      screen.getByRole("heading", { name: "Dashain Celebration" }),
    ).toBeInTheDocument();
  });

  it("does not render a back-to-calendar control", () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
      "board",
    );

    expect(
      screen.queryByRole("button", { name: /Clear selection|Calendar/i }),
    ).not.toBeInTheDocument();
  });

  it("shows empty-day state when calendar day has no events", () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-16"
        dayEvents={[]}
        selectedEventId={null}
        onSelectEvent={vi.fn()}
        eventDetail={null}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
    );

    expect(screen.getByText("No events on this day.")).toBeInTheDocument();
  });

  it("hides Manage for general members", () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
      "general",
    );

    expect(screen.queryByRole("link", { name: /Manage Event/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Event health")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs Attention")).not.toBeInTheDocument();
  });

  it("shows selected RSVP state and updates from quick actions", async () => {
    const user = userEvent.setup();
    const onRsvpStatusChange = vi.fn();

    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={{
          ...eventDetail,
          current_member_rsvp_status: "going",
        }}
        detailLoading={false}
        detailError={null}
        {...panelProps}
        onRsvpStatusChange={onRsvpStatusChange}
      />,
    );

    const going = screen.getByRole("button", { name: /^Going$/i });
    const maybe = screen.getByRole("button", { name: /^Maybe$/i });
    const notGoing = screen.getByRole("button", { name: /^Can't Go$/i });

    expect(going).toHaveAttribute("aria-pressed", "true");
    expect(maybe).toHaveAttribute("aria-pressed", "false");
    expect(notGoing).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(maybe);
    expect(onRsvpStatusChange).toHaveBeenCalledWith("maybe");
    await waitFor(() => {
      expect(maybe).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("keeps fixed content order including a zero-attendee row", async () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[
          createMockEventResponse({
            ...dayEvent,
            location: "Campus Lawn",
          }),
        ]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={createMockEventDetailResponse({
          ...eventDetail,
          location: "Campus Lawn",
        })}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
      "board",
    );

    const banner = await screen.findByText("Cultural");
    const title = screen.getByRole("heading", { name: "Dashain Celebration" });
    const meta = screen.getByLabelText("Date, time, and location");
    const rsvp = screen.getByLabelText("Your RSVP");
    const attendees = await screen.findByText("0 attending");
    const health = await screen.findByText("Event health");

    expect(screen.getByTestId("event-attendees-row")).toContainElement(
      attendees,
    );
    expect(
      screen.queryByRole("button", { name: /View attendees/i }),
    ).not.toBeInTheDocument();

    const order = [
      banner.closest(".event-banner") ?? banner,
      title,
      meta,
      rsvp,
      attendees.closest("[data-testid='event-attendees-row']") ?? attendees,
      health.closest("details") ?? health,
    ];

    for (let index = 1; index < order.length; index += 1) {
      expect(
        order[index - 1]!.compareDocumentPosition(order[index]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("switches events when multiple occur on the same day", async () => {
    const user = userEvent.setup();
    const onSelectEvent = vi.fn();
    const secondEvent: EventResponse = {
      ...dayEvent,
      id: 2,
      name: "Board Meeting",
      event_type: "meeting",
    };

    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent, secondEvent]}
        selectedEventId={1}
        onSelectEvent={onSelectEvent}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
      "board",
    );

    await user.click(screen.getByRole("button", { name: "Board Meeting" }));
    expect(onSelectEvent).toHaveBeenCalledWith(2);
  });
});
