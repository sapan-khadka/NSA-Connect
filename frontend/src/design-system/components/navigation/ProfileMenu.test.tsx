import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileMenu } from "./ProfileMenu";

afterEach(() => {
  cleanup();
});

describe("ProfileMenu", () => {
  it("shows avatar, name, role, and organization in the panel", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfileMenu
          name="Ada Lovelace"
          role="President"
          organization="NSA Connect"
          items={[
            { id: "profile", label: "Profile", to: "/members/1" },
            { id: "settings", label: "Settings", to: "/profile" },
            { id: "help", label: "Help", to: "/assistant" },
            {
              id: "logout",
              label: "Log out",
              tone: "danger",
              dividerBefore: true,
              onClick: () => undefined,
            },
          ]}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );

    const menu = screen.getByRole("menu", { name: "Account" });
    expect(within(menu).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(menu).getByText("President")).toBeInTheDocument();
    expect(within(menu).getByText("NSA Connect")).toBeInTheDocument();
    expect(within(menu).getByRole("img", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/members/1",
    );
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(within(menu).getByRole("menuitem", { name: "Help" })).toHaveAttribute(
      "href",
      "/assistant",
    );
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
  });

  it("runs logout and closes the menu", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <MemoryRouter>
        <ProfileMenu
          name="Ada Lovelace"
          role="President"
          items={[
            {
              id: "logout",
              label: "Log out",
              tone: "danger",
              onClick: onLogout,
            },
          ]}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("supports keyboard open and arrow navigation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfileMenu
          name="Ada Lovelace"
          role="Board"
          items={[
            { id: "profile", label: "Profile", to: "/members/1" },
            { id: "settings", label: "Settings", to: "/profile" },
          ]}
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", {
      name: "Account menu for Ada Lovelace",
    });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("menu", { name: "Account" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();
    });

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveFocus();
  });
});
