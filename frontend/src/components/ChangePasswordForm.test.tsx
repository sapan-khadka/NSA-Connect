import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "./ChangePasswordForm";

vi.mock("../lib/members-api", () => ({
  changeMyPassword: vi.fn(),
}));

import { changeMyPassword } from "../lib/members-api";

describe("ChangePasswordForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("updates the password when the form is valid", async () => {
    const user = userEvent.setup();
    vi.mocked(changeMyPassword).mockResolvedValue();

    render(
      <MemoryRouter>
        <ChangePasswordForm />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Current password"), "oldpassword");
    await user.type(screen.getByLabelText("New password"), "newpassword1");
    await user.type(screen.getByLabelText("Confirm new password"), "newpassword1");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(changeMyPassword).toHaveBeenCalledWith({
        current_password: "oldpassword",
        new_password: "newpassword1",
      }),
    );
    expect(
      await screen.findByText("Password updated successfully."),
    ).toBeInTheDocument();
  });
});
