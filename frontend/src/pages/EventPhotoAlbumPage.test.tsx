import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventPhotoAlbumPage } from "../pages/EventPhotoAlbumPage";
import type { CalendarReturnState } from "../lib/event-manage-navigation";

vi.mock("../lib/photo-archive-api", () => ({
  fetchEventPhotos: vi.fn().mockResolvedValue({
    event_id: 33,
    event_name: "WT Cultural Night",
    photos: [],
    total: 0,
  }),
  deleteEventPhoto: vi.fn(),
  uploadEventPhoto: vi.fn(),
}));

describe("EventPhotoAlbumPage calendar return", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("links back to calendar with the same event when opened from overview", async () => {
    const returnState: CalendarReturnState = {
      fromCalendar: true,
      calendarDate: "2026-07-28",
      calendarEventId: 33,
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/events/photos/33",
            state: returnState,
          },
        ]}
      >
        <Routes>
          <Route path="/events/photos/:eventId" element={<EventPhotoAlbumPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const back = await screen.findByRole("link", {
      name: /Back to WT Cultural Night/i,
    });
    expect(back).toHaveAttribute(
      "href",
      "/events/calendar?date=2026-07-28&event=33",
    );
  });

  it("falls back to photo archive when not opened from calendar", async () => {
    render(
      <MemoryRouter initialEntries={["/events/photos/33"]}>
        <Routes>
          <Route path="/events/photos/:eventId" element={<EventPhotoAlbumPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", { name: /Photo archive/i }),
    ).toHaveAttribute("href", "/events/photos");
  });
});
