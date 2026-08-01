import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("lists meetings with calm hierarchy and unique KPI filters", async () => {
    const user = userEvent.setup();
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
          action_item_count: 0,
          minutes_updated_at: null,
        },
        {
          event_id: 1,
          event_name: "March Board Meeting",
          starts_at: "2030-05-01T18:00:00+00:00",
          is_past: true,
          agenda: "Budget review",
          has_attendance: true,
          has_minutes: false,
          has_summary: false,
          present_count: 5,
          absent_count: 1,
          excused_count: 0,
          unmarked_count: 0,
          action_item_count: 2,
          minutes_updated_at: null,
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

    expect(
      await screen.findByRole("heading", { name: "Meetings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("April Board Meeting")).toBeInTheDocument();
    expect(screen.getByText("March Board Meeting")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Attendance")).toBeInTheDocument();
    expect(screen.getByText("Minutes")).toBeInTheDocument();
    expect(screen.getByText("May 2030")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /April Board Meeting/i }),
    ).toHaveAttribute("href", "/events/meetings/2");
    expect(
      screen.getByRole("link", { name: /March Board Meeting/i }),
    ).toHaveAttribute("href", "/events/meetings/1");

    await user.click(screen.getByRole("button", { name: /Missing minutes/i }));
    expect(screen.queryByText("April Board Meeting")).not.toBeInTheDocument();
    expect(screen.getByText("March Board Meeting")).toBeInTheDocument();
  });
});
