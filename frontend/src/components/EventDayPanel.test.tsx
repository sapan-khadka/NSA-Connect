import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi, type ReactElement } from "vitest";

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
  onRsvpStatusChange: vi.fn(),
};

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("EventDayPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows upcoming events when no day is selected", () => {
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

    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Dashain Celebration/i }),
    ).toHaveAttribute("href", "/events/1");
  });

  it("shows event details, progress bar, and checklist items", () => {
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
    );

    expect(
      screen.getByRole("link", { name: "Dashain Celebration" }),
    ).toHaveAttribute("href", "/events/1");
    expect(
      screen.getByRole("progressbar", { name: "Overall task progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Task progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Going" })).toBeInTheDocument();
    expect(screen.getByText("Order catering")).toBeInTheDocument();
  });

  it("shows selected RSVP state without attendee counts", () => {
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
      />,
    );

    expect(screen.getByRole("button", { name: "Going" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText(/members going/i)).not.toBeInTheDocument();
  });

  it("hides the delete button when the member cannot manage events", () => {
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
    );

    expect(
      screen.queryByRole("button", { name: "Delete event" }),
    ).not.toBeInTheDocument();
  });

  it("calls onDeleteEvent after confirmation when allowed", async () => {
    const user = userEvent.setup();
    const onDeleteEvent = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPanel(
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

    renderPanel(
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
    );

    await user.click(screen.getByRole("button", { name: "Board Meeting" }));
    expect(onSelectEvent).toHaveBeenCalledWith(2);
  });

  it("hides budget for general members", () => {
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
        member={createMockMember("general")}
      />,
    );

    expect(screen.queryByText(/Budget/i)).not.toBeInTheDocument();
  });

  it("wraps tasks in a collapsible section for general members", () => {
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
        member={createMockMember("general")}
      />,
    );

    const details = screen.getByText("Tasks & volunteer").closest("details");
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute("open");
  });

  it("shows a meeting management link for board members", () => {
    renderPanel(
      <EventDayPanel
        selectedDate="2030-06-15"
        dayEvents={[dayEvent]}
        selectedEventId={1}
        onSelectEvent={vi.fn()}
        eventDetail={{ ...eventDetail, event_type: "meeting" }}
        detailLoading={false}
        detailError={null}
        {...panelProps}
        member={createMockMember("board")}
      />,
    );

    expect(
      screen.getByRole("link", { name: "View meeting record ›" }),
    ).toHaveAttribute("href", "/events/meetings/1");
  });

  it("shows budget for board members", () => {
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
        member={createMockMember("board")}
      />,
    );

    expect(screen.getByText(/Budget \$250\.00/)).toBeInTheDocument();
  });
});
