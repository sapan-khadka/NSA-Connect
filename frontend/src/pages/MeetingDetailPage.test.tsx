import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    saveMeetingNotes: vi.fn(),
    summarizeMeetingForEvent: vi.fn(),
    saveMeetingAttendance: vi.fn(),
  };
});

vi.mock("../components/DiscussionFeed", () => ({
  DiscussionFeed: () => <div>Discussion feed</div>,
}));

vi.mock("../components/MeetingFilesPanel", () => ({
  MeetingFilesPanel: () => <div>Meeting files</div>,
}));

vi.mock("../components/MeetingAttendancePanel", () => ({
  MeetingAttendancePanel: () => <div>Attendance panel</div>,
}));

const detail = {
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
};

describe("MeetingDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens the minutes tab and focuses notes from a deep link", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(fetchMeetingDetail).mockResolvedValue(detail);

    render(
      <MemoryRouter initialEntries={["/events/meetings/5?tab=minutes"]}>
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
    expect(
      screen.getByRole("tab", { name: "Minutes", selected: true }),
    ).toBeInTheDocument();
  });

  it("maps legacy #meeting-minutes hash to the minutes tab", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(fetchMeetingDetail).mockResolvedValue(detail);

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

    expect(await screen.findByLabelText("Minutes notes")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Minutes", selected: true }),
    ).toBeInTheDocument();
  });

  it("renders overview stats and section tabs", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMeetingDetail).mockResolvedValue(detail);

    render(
      <MemoryRouter initialEntries={["/events/meetings/5"]}>
        <Routes>
          <Route
            path="/events/meetings/:eventId"
            element={<MeetingDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "WT Meeting 5" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "Meeting sections" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Continue working")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(screen.getByText("Updates")).toBeInTheDocument();
  });
});
