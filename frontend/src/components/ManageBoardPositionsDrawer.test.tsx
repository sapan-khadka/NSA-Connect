import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveCustomBoardPosition,
  createCustomBoardPosition,
  fetchMemberPositionCatalog,
  renameCustomBoardPosition,
} from "../lib/members-api";
import { MEMBER_POSITIONS } from "../lib/roles";
import { ManageBoardPositionsDrawer } from "./ManageBoardPositionsDrawer";

vi.mock("../lib/members-api", () => ({
  fetchMemberPositionCatalog: vi.fn(),
  createCustomBoardPosition: vi.fn(),
  renameCustomBoardPosition: vi.fn(),
  archiveCustomBoardPosition: vi.fn(),
}));

const catalog = {
  built_in: MEMBER_POSITIONS.filter((key) => key !== "member").map((key) => ({
    key,
    label: key,
    immutable: true as const,
  })),
  custom: [
    {
      id: 3,
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

describe("ManageBoardPositionsDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists built-in and custom positions and supports add/rename/archive", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMemberPositionCatalog).mockResolvedValue(catalog);
    vi.mocked(createCustomBoardPosition).mockResolvedValue({
      ...catalog.custom[0]!,
      id: 4,
      name: "Wellness Lead",
      holder: null,
    });
    vi.mocked(renameCustomBoardPosition).mockResolvedValue({
      ...catalog.custom[0]!,
      name: "Arts Lead",
    });
    vi.mocked(archiveCustomBoardPosition).mockResolvedValue({
      ...catalog.custom[0]!,
      is_active: false,
      archived_at: "2026-02-01T00:00:00Z",
    });

    render(
      <ManageBoardPositionsDrawer open onClose={vi.fn()} onCatalogChanged={vi.fn()} />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: /Manage board positions/i,
    });
    expect(within(dialog).getAllByText("Protected").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Cultural Lead")).toBeInTheDocument();
    expect(within(dialog).getByText("Held by Alex Rivera")).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText(/New custom position name/i),
      "Wellness Lead",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(createCustomBoardPosition).toHaveBeenCalledWith("Wellness Lead");
    });

    await user.click(within(dialog).getByRole("button", { name: "Rename" }));
    const renameInput = within(dialog).getByLabelText(/Rename Cultural Lead/i);
    await user.clear(renameInput);
    await user.type(renameInput, "Arts Lead");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(renameCustomBoardPosition).toHaveBeenCalledWith(3, "Arts Lead");
    });

    await user.click(within(dialog).getByRole("button", { name: "Archive" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm archive" }),
    );
    await waitFor(() => {
      expect(archiveCustomBoardPosition).toHaveBeenCalledWith(3);
    });
  });
});
