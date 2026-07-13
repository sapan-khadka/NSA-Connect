import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDayPanel } from "./EventDayPanel";
import type { EventDetailResponse, EventResponse } from "../lib/events-api";
import {
  createMockEventDetailResponse,
  createMockEventResponse,
  createMockMember,
  MockAuthProvider,
} from "../test/test-utils";

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
  onBackToUpcoming: vi.fn(),
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

describe("EventDayPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the upcoming list by default", () => {
    renderPanel(
      <EventDayPanel
        panelMode="upcoming"
        selectedDate={null}
        dayEvents={[]}
        selectedEventId={null}
        onSelectEvent={vi.fn()}
        eventDetail={null}
        detailLoading={false}
        detailError={null}
        upcomingEvents={[dayEvent]}
        upcomingLoading={false}
        {...panelProps}
      />,
    );

    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(document.querySelector(".events-upcoming-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dashain Celebration/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Back to upcoming/i }),
    ).not.toBeInTheDocument();
  });

  it("swaps to event detail with back control and RSVP", () => {
    renderPanel(
      <EventDayPanel
        panelMode="detail"
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        upcomingEvents={[dayEvent]}
        upcomingLoading={false}
        {...panelProps}
      />,
      "board",
    );

    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Back to upcoming/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByText("Cultural")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Going" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Manage$/i })).toHaveAttribute(
      "href",
      "/events/1/manage",
    );
  });

  it("hides Manage for general members", () => {
    renderPanel(
      <EventDayPanel
        panelMode="detail"
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        upcomingEvents={[dayEvent]}
        upcomingLoading={false}
        {...panelProps}
      />,
      "general",
    );

    expect(screen.queryByRole("link", { name: /^Manage$/i })).not.toBeInTheDocument();
  });

  it("returns to upcoming when back is clicked", async () => {
    const user = userEvent.setup();
    const onBackToUpcoming = vi.fn();

    renderPanel(
      <EventDayPanel
        panelMode="detail"
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        upcomingEvents={[dayEvent]}
        upcomingLoading={false}
        {...panelProps}
        onBackToUpcoming={onBackToUpcoming}
      />,
      "board",
    );

    await user.click(screen.getByRole("button", { name: /Back to upcoming/i }));
    expect(onBackToUpcoming).toHaveBeenCalledTimes(1);
  });

  it("shows selected RSVP state in detail mode", () => {
    renderPanel(
      <EventDayPanel
        panelMode="detail"
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
        upcomingEvents={[]}
        upcomingLoading={false}
        {...panelProps}
      />,
    );

    expect(screen.getByRole("button", { name: "Going" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
        panelMode="detail"
        selectedDate="2030-06-15"
        dayEvents={[dayEvent, secondEvent]}
        selectedEventId={1}
        onSelectEvent={onSelectEvent}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        upcomingEvents={[]}
        upcomingLoading={false}
        {...panelProps}
      />,
      "board",
    );

    await user.click(screen.getByRole("button", { name: "Board Meeting" }));
    expect(onSelectEvent).toHaveBeenCalledWith(2);
  });
});
