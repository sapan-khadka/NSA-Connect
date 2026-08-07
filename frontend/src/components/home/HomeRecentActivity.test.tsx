import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatPersonalActivityWhen,
  HomeRecentActivity,
} from "./HomeRecentActivity";

vi.mock("../../lib/members-api", () => ({
  fetchMemberActivity: vi.fn(),
}));

import { fetchMemberActivity } from "../../lib/members-api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("formatPersonalActivityWhen", () => {
  const now = new Date("2026-08-01T16:00:00");

  it("formats today with comma and time", () => {
    expect(
      formatPersonalActivityWhen("2026-08-01T16:30:00", now),
    ).toMatch(/^Today, /);
  });

  it("formats yesterday with time", () => {
    expect(
      formatPersonalActivityWhen("2026-07-31T16:15:00", now),
    ).toMatch(/^Yesterday, /);
  });

  it("formats older dates as month day with time", () => {
    expect(
      formatPersonalActivityWhen("2026-07-30T21:10:00", now),
    ).toMatch(/^Jul 30, /);
  });
});

describe("HomeRecentActivity", () => {
  it("renders mock row structure: badge, verb, subject, when", async () => {
    const todayIso = new Date().toISOString();
    vi.mocked(fetchMemberActivity).mockResolvedValue({
      items: [
        {
          id: "1",
          type: "task_completed",
          description: "Completed Budget Report",
          timestamp: todayIso,
          task_id: 9,
          event_id: 3,
          dues_record_id: null,
        },
      ],
      total: 1,
    });

    render(
      <MemoryRouter>
        <HomeRecentActivity memberId={7} limit={6} />
      </MemoryRouter>,
    );

    const card = await screen.findByLabelText("Recent Activity");
    expect(
      within(card).getByRole("heading", { name: "Recent Activity" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: /View history/i }),
    ).toHaveAttribute("href", "/members/7");

    await waitFor(() => {
      expect(within(card).getByText("Completed")).toBeInTheDocument();
    });
    expect(within(card).getByText("Budget Report")).toBeInTheDocument();
    expect(within(card).getByText(/^Today, /)).toBeInTheDocument();
    expect(card.querySelector(".home-ya__badge--task_completed")).not.toBeNull();
    expect(card.querySelector(".home-ya__row")).not.toBeNull();
  });

  it("renders meeting notes as an activity type", async () => {
    vi.mocked(fetchMemberActivity).mockResolvedValue({
      items: [
        {
          id: "meeting_notes-3",
          type: "meeting_notes",
          description: "Updated meeting notes for March Board Meeting",
          timestamp: "2026-08-01T15:00:00",
          task_id: null,
          event_id: 12,
          dues_record_id: null,
        },
      ],
      total: 1,
    });

    render(
      <MemoryRouter>
        <HomeRecentActivity memberId={7} limit={6} />
      </MemoryRouter>,
    );

    const card = await screen.findByLabelText("Recent Activity");
    await waitFor(() => {
      expect(within(card).getByText("Notes")).toBeInTheDocument();
    });
    expect(within(card).getByText("March Board Meeting")).toBeInTheDocument();
    expect(card.querySelector(".home-ya__badge--meeting_notes")).not.toBeNull();
    expect(
      within(card).getByRole("link", { name: /Notes/i }),
    ).toHaveAttribute("href", "/events/meetings/12?tab=minutes");
  });
});
