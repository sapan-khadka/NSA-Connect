import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockMember } from "../../test/test-utils";
import { SettingsPrivacyPage } from "./SettingsPrivacyPage";

vi.mock("../../lib/members-api", () => ({
  fetchMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));

const mockMember = {
  ...createMockMember("general"),
  email_visibility: "public" as const,
  phone_visibility: "board_only" as const,
  social_handle_visibility: "board_only" as const,
};

describe("SettingsPrivacyPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("saves directory visibility without mixing in profile fields", async () => {
    const user = userEvent.setup();
    const { fetchMyProfile, updateMyProfile } = await import(
      "../../lib/members-api"
    );
    vi.mocked(fetchMyProfile).mockResolvedValue(mockMember);
    vi.mocked(updateMyProfile).mockResolvedValue({
      ...mockMember,
      phone_visibility: "public",
    });

    render(
      <MockAuthProvider
        value={{
          member: mockMember,
          isAuthenticated: true,
          updateMember: vi.fn(),
        }}
      >
        <MemoryRouter>
          <SettingsPrivacyPage />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    const phoneGroup = await screen.findByRole("group", {
      name: "Phone visibility",
    });
    await user.click(within(phoneGroup).getByRole("button", { name: "Public" }));

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith({
        phone_visibility: "public",
      });
    });
  });
});
