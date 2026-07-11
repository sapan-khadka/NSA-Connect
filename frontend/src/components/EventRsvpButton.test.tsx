import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventRsvpButton } from "./EventRsvpButton";

describe("EventRsvpButton", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
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

  it.each([
    {
      status: "going" as const,
      label: "Going",
      message: "Yayyy! Can't wait to see you there.",
      className: "text-accent",
      emojiClass: "rsvp-reaction-burst",
    },
    {
      status: "maybe" as const,
      label: "Maybe",
      message: "Still deciding? We'd love to see you there.",
      className: "text-marigold",
      emojiClass: "rsvp-reaction-wobble",
    },
    {
      status: "not_going" as const,
      label: "Not going",
      message: "Aww, we'll miss you. See you next time.",
      className: "text-label",
      emojiClass: "rsvp-reaction-cry-sink",
    },
  ])(
    "shows the $status confirmation immediately on click",
    async ({ status, label, message, className, emojiClass }) => {
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

      await user.click(screen.getByRole("button", { name: label }));

      const confirmation = screen.getByText(message);
      expect(confirmation).toHaveAttribute("role", "status");
      expect(confirmation).toHaveClass("rsvp-confirmation-message", className);
      expect(onStatusChange).toHaveBeenCalledWith(status);
      expect(document.querySelectorAll(`.${emojiClass}`).length).toBeGreaterThan(0);
    },
  );

  it.each([
    {
      status: "going" as const,
      message: "Yayyy! Can't wait to see you there.",
      className: "text-accent",
    },
    {
      status: "maybe" as const,
      message: "Still deciding? We'd love to see you there.",
      className: "text-marigold",
    },
    {
      status: "not_going" as const,
      message: "Aww, we'll miss you. See you next time.",
      className: "text-label",
    },
  ])(
    "shows the $status confirmation message with styling when selected",
    ({ status, message, className }) => {
      render(
        <EventRsvpButton
          currentStatus={status}
          canRsvp
          loading={false}
          onStatusChange={vi.fn()}
        />,
      );

      const confirmation = screen.getByText(message);
      expect(confirmation).toHaveAttribute("role", "status");
      expect(confirmation).toHaveClass("rsvp-confirmation-message", className);
    },
  );

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

  it("shows confirmation after selection in the segmented variant", async () => {
    const user = userEvent.setup();

    render(
      <EventRsvpButton
        currentStatus={null}
        canRsvp
        loading={false}
        variant="segmented"
        onStatusChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Going" }));

    const confirmation = screen.getByText("Yayyy! Can't wait to see you there.");
    expect(confirmation).toHaveAttribute("role", "status");
    expect(confirmation).toHaveClass("rsvp-confirmation-message");
  });
});
