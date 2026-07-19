import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMeetings, type MeetingSummary } from "../../lib/meetings-api";
import { HomeMeetingMinutesCard } from "./HomeMeetingMinutesCard";

vi.mock("../../lib/meetings-api", () => ({
  fetchMeetings: vi.fn(),
}));

const meeting: MeetingSummary = {
  event_id: 5,
  event_name: "WT Meeting 5",
  starts_at: "2030-07-22T18:00:00Z",
  is_past: false,
  agenda: "Board updates",
  has_attendance: false,
  has_minutes: false,
  has_summary: false,
  present_count: 0,
  absent_count: 0,
  excused_count: 0,
  unmarked_count: 5,
  minutes_updated_at: null,
};

function renderCard() {
  return render(
    <MemoryRouter>
      <HomeMeetingMinutesCard />
    </MemoryRouter>,
  );
}

describe("HomeMeetingMinutesCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    {
      state: {},
      label: "Write notes",
    },
    {
      state: { has_minutes: true },
      label: "Review & publish",
    },
    {
      state: { has_minutes: true, has_summary: true },
      label: "View minutes",
    },
  ])("links the selected meeting workflow to its record: $label", async ({
    state,
    label,
  }) => {
    vi.mocked(fetchMeetings).mockResolvedValue({
      meetings: [{ ...meeting, ...state }],
      total: 1,
    });
    renderCard();

    const card = await screen.findByLabelText("Meeting Minutes");
    expect(
      within(card).getByRole("link", { name: "Open WT Meeting 5" }),
    ).toHaveAttribute("href", "/events/meetings/5");
    expect(within(card).getByRole("link", { name: label })).toHaveAttribute(
      "href",
      "/events/meetings/5#meeting-minutes",
    );
    expect(
      within(card).queryByRole("link", { name: "Summarize notes" }),
    ).not.toBeInTheDocument();
  });

  it("links the header to the complete meetings list", async () => {
    vi.mocked(fetchMeetings).mockResolvedValue({ meetings: [], total: 0 });
    renderCard();

    const card = await screen.findByLabelText("Meeting Minutes");
    expect(
      within(card).getByRole("link", { name: "All meetings" }),
    ).toHaveAttribute("href", "/events/meetings");
    expect(
      within(card).getByRole("link", { name: "View board meetings" }),
    ).toHaveAttribute("href", "/events/meetings");
  });
});
