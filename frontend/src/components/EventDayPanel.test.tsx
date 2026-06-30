import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDayPanel } from "./EventDayPanel";
import type { EventDetailResponse, EventResponse } from "../lib/events-api";
import { createMockEventResponse, createMockMember } from "../test/test-utils";

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn(),
  createEventTask: vi.fn(),
  updateEventTask: vi.fn(),
  updateEventTaskChecklistItem: vi.fn(),
  deleteEventTask: vi.fn(),
}));

const dayEvent: EventResponse = createMockEventResponse({
  id: 1,
  name: "Dashain Celebration",
  starts_at: "2030-06-15T18:00:00+00:00",
  created_by_id: 2,
});

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
  member: null,
  canManageSimple: false,
  canAssignChecklist: false,
  assignableMembers: [] as import("../lib/auth-api").MemberResponse[],
  taskRefreshKey: 1,
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
      screen.getByText(/Click a calendar day to view events and tasks/i),
    ).toBeInTheDocument();
  });

  it("shows event details, progress bar, and checklist items", () => {
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
    expect(
      screen.getByRole("progressbar", { name: "Overall task progress" }),
    ).toBeInTheDocument();
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

  it("hides the delete button when the member cannot manage events", () => {
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

    expect(
      screen.queryByRole("button", { name: "Delete event" }),
    ).not.toBeInTheDocument();
  });

  it("calls onDeleteEvent after confirmation when allowed", async () => {
    const user = userEvent.setup();
    const onDeleteEvent = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        canDeleteEvent
        onDeleteEvent={onDeleteEvent}
        {...panelProps}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete event" }));
    expect(onDeleteEvent).toHaveBeenCalledWith(1);

    vi.restoreAllMocks();
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onDeleteEvent = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={eventDetail}
        detailLoading={false}
        detailError={null}
        canDeleteEvent
        onDeleteEvent={onDeleteEvent}
        {...panelProps}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete event" }));
    expect(onDeleteEvent).not.toHaveBeenCalled();

    vi.restoreAllMocks();
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

  it("hides budget for general members", () => {
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
        member={createMockMember("general")}
      />,
    );

    expect(screen.queryByText(/Budget/i)).not.toBeInTheDocument();
  });

  it("shows budget for board members", () => {
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
        member={createMockMember("board")}
      />,
    );

    expect(screen.getByText(/Budget \$250\.00/)).toBeInTheDocument();
  });
});
