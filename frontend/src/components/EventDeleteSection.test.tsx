import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventDeleteSection } from "./EventDeleteSection";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../lib/events-api", () => ({
  deleteEvent: vi.fn(),
}));

describe("EventDeleteSection", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("deletes the event and navigates to the calendar", async () => {
    const user = userEvent.setup();
    const { deleteEvent } = await import("../lib/events-api");
    vi.mocked(deleteEvent).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <EventDeleteSection eventId={7} eventName="Spring Social" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Delete event" }));

    await waitFor(() => {
      expect(deleteEvent).toHaveBeenCalledWith(7);
      expect(mockNavigate).toHaveBeenCalledWith("/events/calendar", {
        replace: true,
      });
    });
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const { deleteEvent } = await import("../lib/events-api");
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(
      <MemoryRouter>
        <EventDeleteSection eventId={7} eventName="Spring Social" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Delete event" }));

    expect(deleteEvent).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
