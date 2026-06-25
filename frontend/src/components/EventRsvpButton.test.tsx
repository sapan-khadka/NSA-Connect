import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventRsvpButton } from "./EventRsvpButton";

describe("EventRsvpButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onRsvp when RSVP is clicked", async () => {
    const user = userEvent.setup();
    const onRsvp = vi.fn();

    render(
      <EventRsvpButton
        hasRsvped={false}
        rsvpCount={0}
        canRsvp
        loading={false}
        onRsvp={onRsvp}
        onCancelRsvp={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "RSVP" }));
    expect(onRsvp).toHaveBeenCalled();
  });

  it("calls onCancelRsvp when member is already going", async () => {
    const user = userEvent.setup();
    const onCancelRsvp = vi.fn();

    render(
      <EventRsvpButton
        hasRsvped
        rsvpCount={2}
        canRsvp
        loading={false}
        onRsvp={vi.fn()}
        onCancelRsvp={onCancelRsvp}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel RSVP" }));
    expect(onCancelRsvp).toHaveBeenCalled();
  });
});
