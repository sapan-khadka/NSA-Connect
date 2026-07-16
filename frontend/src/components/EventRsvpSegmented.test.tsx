import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventRsvpSegmented } from "./EventRsvpSegmented";

describe("EventRsvpSegmented", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders equal Going / Maybe / Can't Go segments", () => {
    render(
      <EventRsvpSegmented
        currentStatus="going"
        canRsvp
        loading={false}
        onStatusChange={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "RSVP options" });
    expect(group.className).toMatch(/rsvp-segmented--equal/);

    const going = screen.getByRole("button", { name: "Going" });
    const maybe = screen.getByRole("button", { name: "Maybe" });
    const cantGo = screen.getByRole("button", { name: "Can't Go" });

    expect(going).toHaveAttribute("aria-pressed", "true");
    expect(going.className).toMatch(/rsvp-segmented-btn--selected/);
    expect(maybe.className).toMatch(/rsvp-segmented-btn--idle/);
    expect(cantGo.className).toMatch(/rsvp-segmented-btn--idle/);
  });

  it("calls onStatusChange immediately on click", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <EventRsvpSegmented
        currentStatus={null}
        canRsvp
        loading={false}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Going" }));
    expect(onStatusChange).toHaveBeenCalledWith("going");

    await user.click(screen.getByRole("button", { name: "Maybe" }));
    expect(onStatusChange).toHaveBeenCalledWith("maybe");

    await user.click(screen.getByRole("button", { name: "Can't Go" }));
    expect(onStatusChange).toHaveBeenCalledWith("not_going");
  });

  it("shows closed copy when RSVP is unavailable", () => {
    render(
      <EventRsvpSegmented
        currentStatus="maybe"
        canRsvp={false}
        loading={false}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Your response: Maybe/i)).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
