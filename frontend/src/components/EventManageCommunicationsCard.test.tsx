import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockEventDetailResponse } from "../test/test-utils";
import { EventManageCommunicationsCard } from "./EventManageCommunicationsCard";

vi.mock("../lib/ai-api", () => ({
  draftAnnouncementEmail: vi.fn(),
}));

vi.mock("../lib/announcements-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/announcements-api")>(
    "../lib/announcements-api",
  );
  return {
    ...actual,
    createAnnouncement: vi.fn(),
    fetchAnnouncements: vi.fn().mockResolvedValue({ announcements: [], total: 0 }),
    fetchAnnouncementRecipientPreview: vi
      .fn()
      .mockResolvedValue({ total: 2, emailable: 1 }),
  };
});

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    fetchEventNotificationStatus: vi
      .fn()
      .mockResolvedValue({ reminder_state: "scheduled" }),
    sendEventRemindersNow: vi.fn(),
  };
});

import { draftAnnouncementEmail } from "../lib/ai-api";
import { createAnnouncement } from "../lib/announcements-api";

const mockedDraft = vi.mocked(draftAnnouncementEmail);
const mockedPublish = vi.mocked(createAnnouncement);

describe("EventManageCommunicationsCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("sends stored event details and keeps the draft editable", async () => {
    const user = userEvent.setup();
    mockedDraft.mockResolvedValue({
      subject: "Nepali Cultural Night 2026",
      body: "When: Friday, November 27, 2026 at 6:00 PM CST\nWhere: UC ballroom",
    });

    render(
      <EventManageCommunicationsCard
        event={createMockEventDetailResponse({
          id: 42,
          name: "Nepali Cultural Night 2026",
          event_type: "cultural",
          starts_at: "2026-11-28T00:00:00Z",
          ends_at: "2026-11-28T03:00:00Z",
          location: "UC ballroom",
          description: "Food, music, and dance.",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compose update" }));
    await user.click(screen.getByRole("button", { name: "Draft with AI" }));

    await waitFor(() => {
      expect(mockedDraft).toHaveBeenCalledWith({
        event_name: "Nepali Cultural Night 2026",
        event_type: "cultural",
        starts_at: "2026-11-28T00:00:00Z",
        ends_at: "2026-11-28T03:00:00Z",
        location: "UC ballroom",
        description: "Food, music, and dance.",
        event_id: 42,
      });
    });

    const title = screen.getByLabelText("Title");
    expect(title).toHaveValue("Nepali Cultural Night 2026");
    await user.clear(title);
    await user.type(title, "Edited title");
    expect(mockedPublish).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Publish announcement" }));

    await waitFor(() => {
      expect(mockedPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Edited title",
          category: "event_related",
          event_id: 42,
        }),
      );
    });
  });
});
