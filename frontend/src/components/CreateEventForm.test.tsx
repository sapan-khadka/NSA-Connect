import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateEventForm } from "./CreateEventForm";

vi.mock("../lib/events-api", () => ({
  createEvent: vi.fn(),
}));

import { createEvent } from "../lib/events-api";

const mockedCreateEvent = vi.mocked(createEvent);

describe("CreateEventForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("expands and validates required fields", async () => {
    const user = userEvent.setup();

    render(<CreateEventForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByText("Event name is required")).toBeInTheDocument();
    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(screen.getByText("Event date is required")).toBeInTheDocument();
    expect(mockedCreateEvent).not.toHaveBeenCalled();
  });

  it("submits a valid event", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    mockedCreateEvent.mockResolvedValue({
      id: 9,
      name: "Spring Social",
      starts_at: "2030-06-15T18:00:00+00:00",
      event_type: "social",
      description: "Food and games.",
      budget: "125.50",
      created_by_id: 2,
      rsvp_count: 0,
      current_member_has_rsvped: false,
    });

    render(<CreateEventForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.type(screen.getByLabelText("Event name"), "Spring Social");
    await user.type(screen.getByLabelText("Description"), "Food and games.");
    await user.selectOptions(screen.getByLabelText("Event type"), "social");
    await user.clear(screen.getByLabelText("Budget (USD)"));
    await user.type(screen.getByLabelText("Budget (USD)"), "125.5");
    await user.type(screen.getByLabelText("Date"), "2030-06-15");
    await user.type(screen.getByLabelText("Start time"), "18:00");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => {
      expect(mockedCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Spring Social",
          description: "Food and games.",
          event_type: "social",
          budget: "125.50",
        }),
      );
    });

    expect(onCreated).toHaveBeenCalled();
  });
});
