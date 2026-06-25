import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDayPanel } from "./EventDayPanel";
import type { EventDetailResponse, EventResponse } from "../lib/events-api";

const dayEvent: EventResponse = {
  id: 1,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  event_type: "cultural",
  description: "Annual cultural night.",
  budget: "250.00",
  created_by_id: 2,
  rsvp_count: 0,
  current_member_has_rsvped: false,
};

const eventDetail: EventDetailResponse = {
  ...dayEvent,
  prep_tasks: [
    {
      id: 10,
      group_name: "Food & Beverage",
      due_date: "2030-06-10T12:00:00+00:00",
      assignee_id: 3,
      is_overdue: false,
      is_complete: false,
      checklist_items: [
        {
          id: 100,
          label: "Order catering",
          is_completed: true,
          sort_order: 0,
        },
        {
          id: 101,
          label: "Confirm dietary restrictions",
          is_completed: false,
          sort_order: 1,
        },
      ],
    },
  ],
};

const panelProps = {
  canToggleChecklist: () => true,
  togglingItemId: null,
  onToggleChecklistItem: vi.fn(),
  rsvpLoading: false,
  onRsvp: vi.fn(),
  onCancelRsvp: vi.fn(),
};

describe("EventDayPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("prompts the user to select a day when none is chosen", () => {
    render(
      <EventDayPanel
        selectedDate={null}
        dayEvents={[]}
        selectedEventId={null}
        onSelectEvent={vi.fn()}
        eventDetail={null}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
    );

    expect(
      screen.getByText(/Click a calendar day to view events and prep checklists/i),
    ).toBeInTheDocument();
  });

  it("shows event details, progress bar, and prep checklist items", () => {
    render(
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
    );

    expect(screen.getByRole("heading", { name: "Dashain Celebration" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Prep progress" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Task progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "RSVP" })).toBeInTheDocument();
    expect(screen.getByText("Order catering")).toBeInTheDocument();
  });

  it("shows cancel RSVP when member is already going", () => {
    render(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={{
          ...eventDetail,
          rsvp_count: 3,
          current_member_has_rsvped: true,
        }}
        detailLoading={false}
        detailError={null}
        {...panelProps}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel RSVP" })).toBeInTheDocument();
    expect(screen.getByText("3 members going")).toBeInTheDocument();
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

    render(
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
    );

    await user.click(screen.getByRole("button", { name: "Board Meeting" }));
    expect(onSelectEvent).toHaveBeenCalledWith(2);
  });
});
