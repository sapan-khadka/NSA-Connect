import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/meetings-api", () => ({
  fetchMeetings: vi.fn(),
}));

import { fetchMeetings } from "../lib/meetings-api";

const mockedFetchMeetings = vi.mocked(fetchMeetings);

describe("BoardMeetingsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists upcoming and past meetings with status", async () => {
    mockedFetchMeetings.mockResolvedValue({
      total: 2,
      meetings: [
        {
          event_id: 2,
          event_name: "April Board Meeting",
          starts_at: "2030-07-01T18:00:00+00:00",
          is_past: false,
          agenda: "Election prep",
          has_attendance: false,
          has_minutes: false,
          has_summary: false,
          present_count: 0,
          absent_count: 0,
          excused_count: 0,
          unmarked_count: 3,
          minutes_updated_at: null,
        },
        {
          event_id: 1,
          event_name: "March Board Meeting",
          starts_at: "2030-05-01T18:00:00+00:00",
          is_past: true,
          agenda: "Budget review",
          has_attendance: true,
          has_minutes: true,
          has_summary: true,
          present_count: 5,
          absent_count: 1,
          excused_count: 0,
          unmarked_count: 0,
          minutes_updated_at: "2030-05-01T20:00:00+00:00",
        },
      ],
    });

    renderWithRouter(undefined, {
      initialEntries: ["/events/meetings"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(await screen.findByRole("heading", { name: "Board meetings" })).toBeInTheDocument();
    expect(screen.getByText("April Board Meeting")).toBeInTheDocument();
    expect(screen.getByText("March Board Meeting")).toBeInTheDocument();
    expect(screen.getByText("Attendance recorded")).toBeInTheDocument();
    expect(screen.getByText("Minutes published")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View meeting" })).toHaveLength(2);
  });
});
