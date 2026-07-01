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

  it("shows a prompt when the member has not responded", () => {
    render(
      <EventRsvpButton
        currentStatus={null}
        canRsvp
        loading={false}
        onStatusChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/You haven't RSVP'd yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Going" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the not-going confirmation message when selected", () => {
    render(
      <EventRsvpButton
        currentStatus="not_going"
        canRsvp
        loading={false}
        onStatusChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Aww, we'll miss you. See you next time."),
    ).toBeInTheDocument();
  });

  it("spawns multiple crying emojis when Not going is clicked", async () => {
    const user = userEvent.setup();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.8);

    render(
      <EventRsvpButton
        currentStatus={null}
        canRsvp
        loading={false}
        onStatusChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Not going" }));

    const emojis = document.querySelectorAll(".rsvp-reaction-cry-sink");
    expect(emojis).toHaveLength(3);

    randomSpy.mockRestore();
  });
});
