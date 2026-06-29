import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { UpcomingEventsPage } from "./UpcomingEventsPage";

vi.mock("../lib/events-api", () => ({
  fetchUpcomingEvents: vi.fn(),
}));

const mockEvents = {
  events: [
    {
      id: 1,
      name: "Dashain Celebration",
      starts_at: "2030-06-01T18:00:00+00:00",
      event_type: "cultural" as const,
      description: "Annual cultural celebration.",
      budget: "500.00",
      created_by_id: 1,
      rsvp_count: 12,
      current_member_has_rsvped: false,
    },
  ],
  total: 1,
};

describe("UpcomingEventsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists upcoming events with links to manage", async () => {
    const { fetchUpcomingEvents } = await import("../lib/events-api");
    vi.mocked(fetchUpcomingEvents).mockResolvedValue(mockEvents);

    render(
      <MockAuthProvider
        value={{
          member: {
            id: 1,
            full_name: "Board User",
            email: "board@semo.edu",
            student_id: "11223344",
            major: "CS",
            graduation_year: 2027,
            role: "board",
            status: "approved",
            position: "member",
          },
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <UpcomingEventsPage />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(await screen.findByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage tasks & budget/i })).toHaveAttribute(
      "href",
      "/events/1/manage",
    );
  });

  it("shows empty state when no events are scheduled", async () => {
    const { fetchUpcomingEvents } = await import("../lib/events-api");
    vi.mocked(fetchUpcomingEvents).mockResolvedValue({ events: [], total: 0 });

    render(
      <MockAuthProvider value={{ member: null, isAuthenticated: false }}>
        <MemoryRouter>
          <UpcomingEventsPage />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(await screen.findByText("No upcoming events")).toBeInTheDocument();
  });
});
