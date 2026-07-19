import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMeetingDetail } from "../lib/meetings-api";
import { MeetingDetailPage } from "./MeetingDetailPage";

vi.mock("../lib/meetings-api", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../lib/meetings-api")>();
  return {
    ...original,
    fetchMeetingDetail: vi.fn(),
  };
});

vi.mock("../components/MeetingRecordSection", () => ({
  MeetingRecordSection: () => (
    <section id="meeting-minutes">
      <textarea id="meeting-minutes-notes" aria-label="Minutes notes" />
    </section>
  ),
}));

describe("MeetingDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("focuses the selected meeting's notes editor from the Home shortcut", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(fetchMeetingDetail).mockResolvedValue({
      event_id: 5,
      event_name: "WT Meeting 5",
      agenda: "Updates",
      starts_at: "2030-07-22T18:00:00Z",
      is_past: false,
      can_manage: true,
      minutes: {
        raw_notes: "",
        summary: null,
        key_decisions: [],
        action_items: [],
        updated_at: null,
        updated_by_name: null,
      },
      attendance: [],
      present_count: 0,
      absent_count: 0,
      excused_count: 0,
      unmarked_count: 0,
    });

    render(
      <MemoryRouter initialEntries={["/events/meetings/5#meeting-minutes"]}>
        <Routes>
          <Route
            path="/events/meetings/:eventId"
            element={<MeetingDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const notes = await screen.findByLabelText("Minutes notes");
    await waitFor(() => expect(notes).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
