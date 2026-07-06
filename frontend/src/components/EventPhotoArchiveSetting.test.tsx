import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventPhotoArchiveSetting } from "./EventPhotoArchiveSetting";
import { createMockEventDetailResponse } from "../test/test-utils";

vi.mock("../lib/events-api", () => ({
  patchEvent: vi.fn(),
}));

import { patchEvent } from "../lib/events-api";

const mockEvent = createMockEventDetailResponse({ show_in_photo_archive: true });

describe("EventPhotoArchiveSetting", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the toggle checked when the event is visible in the archive", () => {
    render(
      <EventPhotoArchiveSetting event={mockEvent} onUpdated={vi.fn()} />,
    );

    expect(
      screen.getByRole("checkbox", { name: /Show in photo archive/i }),
    ).toBeChecked();
  });

  it("saves when the toggle is changed", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    vi.mocked(patchEvent).mockResolvedValue({
      ...mockEvent,
      show_in_photo_archive: false,
    });

    render(
      <EventPhotoArchiveSetting event={mockEvent} onUpdated={onUpdated} />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: /Show in photo archive/i }),
    );

    await waitFor(() => {
      expect(patchEvent).toHaveBeenCalledWith(mockEvent.id, {
        show_in_photo_archive: false,
      });
    });
    expect(onUpdated).toHaveBeenCalledWith({
      ...mockEvent,
      show_in_photo_archive: false,
    });
  });
});
