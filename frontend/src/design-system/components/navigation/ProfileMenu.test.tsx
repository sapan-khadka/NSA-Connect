import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileMenu } from "./ProfileMenu";

afterEach(() => {
  cleanup();
});

describe("ProfileMenu", () => {
  it("shows name, subtitle, and menu links in the panel", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfileMenu
          name="Ada Lovelace"
          subtitle="President"
          items={[
            { id: "profile", label: "Profile", to: "/members/1" },
            { id: "settings", label: "Settings", to: "/profile" },
            { id: "help", label: "Help", to: "/assistant" },
            {
              id: "logout",
              label: "Log out",
              tone: "danger",
              onClick: () => undefined,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("img", { name: "Ada Lovelace" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );

    const menu = screen.getByRole("menu", { name: "Account" });
    expect(within(menu).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(menu).getByText("President")).toBeInTheDocument();
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
    expect(within(menu).getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("runs logout and closes the menu", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <MemoryRouter>
        <ProfileMenu
          name="Ada Lovelace"
          subtitle="President"
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

  it("opens the menu with the keyboard", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfileMenu
          name="Ada Lovelace"
          subtitle="Board"
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
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
  });
});
