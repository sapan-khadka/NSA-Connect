import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationPreferencesSection } from "./NotificationPreferencesSection";

vi.mock("../lib/notifications-api", () => ({
  fetchNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

describe("NotificationPreferencesSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("groups preferences and saves a toggle immediately", async () => {
    const user = userEvent.setup();
    const {
      fetchNotificationPreferences,
      updateNotificationPreferences,
    } = await import("../lib/notifications-api");
    vi.mocked(fetchNotificationPreferences).mockResolvedValue({
      event_reminders: true,
      rsvp_nudges: true,
      task_reminders: true,
      dues_reminders: true,
      announcements: true,
    });
    vi.mocked(updateNotificationPreferences).mockResolvedValue({
      event_reminders: false,
      rsvp_nudges: true,
      task_reminders: true,
      dues_reminders: true,
      announcements: true,
    });

    render(<NotificationPreferencesSection />);

    expect(await screen.findByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.queryByText("Delivery")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("switch", { name: "Event reminders on" }),
    );

    await waitFor(() => {
      expect(updateNotificationPreferences).toHaveBeenCalledWith({
        event_reminders: false,
      });
    });
  });
});
