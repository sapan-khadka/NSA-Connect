import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMemberPositionCatalog } from "../lib/members-api";
import { MEMBER_POSITIONS } from "../lib/roles";
import { createMockMember } from "../test/test-utils";
import { PositionSelect } from "./PositionSelect";

vi.mock("../lib/members-api", () => ({
  fetchMemberPositionCatalog: vi.fn(),
}));

const builtInCatalog = {
  built_in: MEMBER_POSITIONS.map((key) => ({
    key,
    label: key,
    immutable: true as const,
  })),
  custom: [
    {
      id: 12,
      name: "Cultural Lead",
      is_active: true,
      created_by_id: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      archived_at: null,
      holder: { id: 9, full_name: "Alex Rivera" },
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PositionSelect", () => {
  it("calls onPositionChange with a fixed assignment", async () => {
    const user = userEvent.setup();
    const onPositionChange = vi.fn();
    const member = createMockMember("board", { id: 4, position: "member" });
    vi.mocked(fetchMemberPositionCatalog).mockResolvedValue(builtInCatalog);

    render(
      <PositionSelect member={member} onPositionChange={onPositionChange} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Cultural Lead (Alex Rivera)" })).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText(/Change position/),
      "fixed:event_manager",
    );

    expect(onPositionChange).toHaveBeenCalledWith(4, {
      kind: "fixed",
      position: "event_manager",
    });
  });

  it("shows who currently holds an exclusive position", async () => {
    const member = createMockMember("board", { id: 4, position: "member" });
    const positionHolders = {
      event_manager: { id: 9, full_name: "Alex Rivera" },
    };
    vi.mocked(fetchMemberPositionCatalog).mockResolvedValue({
      ...builtInCatalog,
      custom: [],
    });

    render(
      <PositionSelect
        member={member}
        positionHolders={positionHolders}
        onPositionChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Event Manager (Alex Rivera)" }),
      ).toBeInTheDocument();
    });
  });

  it("assigns a custom catalog seat", async () => {
    const user = userEvent.setup();
    const onPositionChange = vi.fn();
    const member = createMockMember("board", { id: 4, position: "member" });
    vi.mocked(fetchMemberPositionCatalog).mockResolvedValue(builtInCatalog);

    render(
      <PositionSelect member={member} onPositionChange={onPositionChange} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Cultural Lead (Alex Rivera)" }),
      ).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText(/Change position/),
      "custom:12",
    );

    expect(onPositionChange).toHaveBeenCalledWith(4, {
      kind: "custom",
      custom_board_position_id: 12,
    });
  });

  it("is disabled for members who are not approved", () => {
    const member = createMockMember("general", {
      id: 5,
      status: "pending",
      position: "member",
    });
    vi.mocked(fetchMemberPositionCatalog).mockResolvedValue({
      ...builtInCatalog,
      custom: [],
    });

    render(<PositionSelect member={member} onPositionChange={vi.fn()} />);

    expect(screen.getByLabelText(/Change position/)).toBeDisabled();
  });
});
