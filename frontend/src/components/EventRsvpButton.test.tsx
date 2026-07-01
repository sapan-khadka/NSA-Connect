import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventRsvpButton } from "./EventRsvpButton";

describe("EventRsvpButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onStatusChange when Going is clicked", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <EventRsvpButton
        currentStatus={null}
        canRsvp
        loading={false}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Going" }));
    expect(onStatusChange).toHaveBeenCalledWith("going");
  });

  it("shows the selected RSVP state", () => {
    render(
      <EventRsvpButton
        currentStatus="maybe"
        canRsvp
        loading={false}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Maybe" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
