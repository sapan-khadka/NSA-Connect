import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";

import { ProfilePage } from "./ProfilePage";

vi.mock("../lib/members-api", () => ({
  fetchMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));

vi.mock("../lib/notifications-api", () => ({
  fetchNotificationPreferences: vi.fn().mockResolvedValue({
    event_reminders: true,
    rsvp_nudges: true,
    task_reminders: true,
  }),
  updateNotificationPreferences: vi.fn(),
  sendTestEmail: vi.fn(),
  runNotificationCheck: vi.fn(),
}));

const mockMember = {
  id: 1,
  full_name: "Test User",
  email: "test@semo.edu",
  student_id: "12345678",
  major: "Computer Science",
  graduation_year: 2028,
  role: "general" as const,
  status: "approved",
  position: "member" as const,
};

function renderProfilePage() {
  const updateMember = vi.fn();

  render(
    <MockAuthProvider
      value={{
        member: mockMember,
        isAuthenticated: true,
        updateMember,
      }}
    >
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </MockAuthProvider>,
  );

  return { updateMember };
}

describe("ProfilePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads and displays the member profile form", async () => {
    const { fetchMyProfile } = await import("../lib/members-api");
    vi.mocked(fetchMyProfile).mockResolvedValue(mockMember);

    renderProfilePage();

    expect(await screen.findByDisplayValue("Test User")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test@semo.edu")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("12345678")).toBeInTheDocument();
  });

  it("saves updated contact info", async () => {
    const user = userEvent.setup();
    const { fetchMyProfile, updateMyProfile } = await import(
      "../lib/members-api"
    );
    const { updateMember } = renderProfilePage();

    vi.mocked(fetchMyProfile).mockResolvedValue(mockMember);
    vi.mocked(updateMyProfile).mockResolvedValue({
      ...mockMember,
      full_name: "New Name",
      major: "Biology",
    });

    await screen.findByDisplayValue("Test User");

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "New Name");
    await user.selectOptions(screen.getByLabelText("Graduation year"), "2029");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "New Name",
          email: "test@semo.edu",
          major: "Computer Science",
          graduation_year: 2029,
        }),
      );
    });
    expect(updateMember).toHaveBeenCalled();
    expect(
      await screen.findByText("Profile updated successfully."),
    ).toBeInTheDocument();
  });
});
