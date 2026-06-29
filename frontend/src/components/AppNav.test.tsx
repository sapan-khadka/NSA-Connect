import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./AppNav";

describe("AccountMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens account actions including settings and logout", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onLogout = vi.fn();

    render(
      <MemoryRouter>
        <AccountMenu fullName="Mukesh Mahato" onLogout={onLogout} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Account menu for Mukesh Mahato" }));

    expect(screen.getByRole("menuitem", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/profile",
    );

    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
