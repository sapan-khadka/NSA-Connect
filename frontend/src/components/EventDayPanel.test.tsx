import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi, type ReactElement } from "vitest";

import { EventDayPanel } from "./EventDayPanel";
import type { EventDetailResponse, EventResponse } from "../lib/events-api";
import { createMockEventResponse } from "../test/test-utils";

const dayEvent: EventResponse = createMockEventResponse({
  id: 1,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  created_by_id: 2,
});

const eventDetail: EventDetailResponse = {
  ...dayEvent,
  prep_tasks: [],
};

const panelProps = {
  rsvpLoading: false,
  onRsvpStatusChange: vi.fn(),
};

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("EventDayPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("prompts to select a day and shows a compact upcoming list", () => {
    renderPanel(
      <EventDayPanel
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

    expect(
      screen.getByText(/Select a day on the calendar/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(document.querySelector(".events-upcoming-panel")).toBeInTheDocument();
    expect(
      document.querySelector(".events-upcoming-panel-scroll"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dashain Celebration/i }),
    ).toBeInTheDocument();
  });

  it("shows event title, badge, time, and RSVP controls for a selected day", () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        upcomingEvents={[]}
        upcomingLoading={false}
        {...panelProps}
      />,
    );

    expect(screen.getByText(/June 15, 2030/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Dashain Celebration" }),
    ).toHaveAttribute("href", "/events/1");
    expect(screen.getByText("Cultural")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Going" })).toBeInTheDocument();
  });

  it("shows selected RSVP state", () => {
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
    );

    await user.click(screen.getByRole("button", { name: "Board Meeting" }));
    expect(onSelectEvent).toHaveBeenCalledWith(2);
  });
});
