import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMockEventResponse,
  createMockMember,
  renderWithRouter,
} from "../test/test-utils";

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    fetchEvent: vi.fn(),
    fetchEventAttendees: vi.fn(),
    updateEventRsvp: vi.fn(),
  };
});

vi.mock("../lib/event-tasks-api", () => ({
  fetchEventTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
}));

import { fetchEvent, fetchEventAttendees } from "../lib/events-api";

const mockedFetchEvent = vi.mocked(fetchEvent);
const mockedFetchEventAttendees = vi.mocked(fetchEventAttendees);

const sampleEvent = {
  ...createMockEventResponse({
    id: 7,
    name: "Spring Social",
    location: "University Center",
    starts_at: "2030-06-15T18:00:00+00:00",
  }),
  prep_tasks: [],
};

describe("EventDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders event details and calendar deep link", async () => {
    mockedFetchEvent.mockResolvedValue(sampleEvent);

    renderWithRouter(undefined, {
      initialEntries: ["/events/7"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("heading", { name: "Spring Social" })).toBeInTheDocument();
    expect(screen.getByText(/University Center/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on calendar/i })).toHaveAttribute(
      "href",
      "/events/calendar?date=2030-06-15&event=7",
    );
  });

  it("shows attendees for board members only", async () => {
    mockedFetchEvent.mockResolvedValue(sampleEvent);
    mockedFetchEventAttendees.mockResolvedValue({
      going_count: 2,
      maybe_count: 1,
      not_going_count: 0,
      no_response_count: 1,
      attendees: [
        {
          member_id: 1,
          full_name: "Board Person",
          member_type: "Board member",
          rsvp_status: "going",
        },
        {
          member_id: 2,
          full_name: "General Person",
          member_type: "General member",
          rsvp_status: "maybe",
        },
      ],
    });

    renderWithRouter(undefined, {
      initialEntries: ["/events/7"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("heading", { name: "Attendees" })).toBeInTheDocument();
    expect(screen.getByTestId("attendee-rsvp-summary")).toHaveTextContent(
      "2 going · 1 maybe · 0 not going · 1 not yet responded",
    );
    expect(screen.getByText("Board Person")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedFetchEventAttendees).toHaveBeenCalledWith(7);
    });
  });

  it("does not show attendees for general members", async () => {
    mockedFetchEvent.mockResolvedValue(sampleEvent);

    renderWithRouter(undefined, {
      initialEntries: ["/events/7"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("heading", { name: "Spring Social" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Attendees" })).not.toBeInTheDocument();
    expect(mockedFetchEventAttendees).not.toHaveBeenCalled();
  });
});
