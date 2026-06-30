import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember } from "../test/test-utils";
import { PositionSelect } from "./PositionSelect";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PositionSelect", () => {
  it("calls onPositionChange when a new position is chosen", async () => {
    const user = userEvent.setup();
    const onPositionChange = vi.fn();
    const member = createMockMember("board", { id: 4, position: "member" });

    render(
      <PositionSelect member={member} onPositionChange={onPositionChange} />,
    );

    await user.selectOptions(
      screen.getByLabelText(/Change position/),
      "event_manager",
    );

    expect(onPositionChange).toHaveBeenCalledWith(4, "event_manager");
  });

  it("shows who currently holds an exclusive position", () => {
    const member = createMockMember("board", { id: 4, position: "member" });
    const positionHolders = {
      event_manager: { id: 9, full_name: "Alex Rivera" },
    };

    render(
      <PositionSelect
        member={member}
        positionHolders={positionHolders}
        onPositionChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Event Manager (Alex Rivera)" }),
    ).toBeInTheDocument();
  });

  it("is disabled for members who are not approved", () => {
    const member = createMockMember("general", {
      id: 5,
      status: "pending",
      position: "member",
    });

    render(<PositionSelect member={member} onPositionChange={vi.fn()} />);

    expect(screen.getByLabelText(/Change position/)).toBeDisabled();
  });
});
