import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "./ChangePasswordForm";

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/members-api", () => ({
  changeMyPassword: vi.fn(),
}));

import { useAuth } from "../context/useAuth";
import { changeMyPassword } from "../lib/members-api";

describe("ChangePasswordForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("updates the password when the form is valid", async () => {
    const updateSessionTokens = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      updateSessionTokens,
    } as never);
    vi.mocked(changeMyPassword).mockResolvedValue({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      token_type: "bearer",
      expires_at: "2026-12-31T00:00:00Z",
      refresh_expires_at: "2027-01-14T00:00:00Z",
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChangePasswordForm email="test@semo.edu" fullName="Test User" />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Current password"), "oldpassword");
    await user.type(screen.getByLabelText("New password"), "river-canyon-9");
    await user.type(screen.getByLabelText("Confirm new password"), "river-canyon-9");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(changeMyPassword).toHaveBeenCalledWith({
        current_password: "oldpassword",
        new_password: "river-canyon-9",
      }),
    );
    expect(updateSessionTokens).toHaveBeenCalledWith({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      token_type: "bearer",
      expires_at: "2026-12-31T00:00:00Z",
      refresh_expires_at: "2027-01-14T00:00:00Z",
    });
    expect(
      await screen.findByText("Password updated successfully."),
    ).toBeInTheDocument();
  });
});
