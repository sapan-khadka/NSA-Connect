import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu, buildNavLinkClass, PrimaryNavLink } from "./AppNav";

describe("buildNavLinkClass", () => {
  it("returns active and inactive editorial link classes", () => {
    expect(buildNavLinkClass(true)).toBe("ds-nav-link ds-nav-link--active");
    expect(buildNavLinkClass(false)).toBe("ds-nav-link");
  });
});

describe("PrimaryNavLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies active underline styling on the current route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ul>
          <PrimaryNavLink to="/" end>
            Home
          </PrimaryNavLink>
        </ul>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveClass("ds-nav-link", "ds-nav-link--active");
  });
});

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

  it("uses a lightweight account trigger without card background", () => {
    render(
      <MemoryRouter>
        <AccountMenu fullName="Mukesh Mahato" onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Account menu for Mukesh Mahato" });
    expect(trigger).toHaveClass("ds-nav-account-trigger");
    expect(trigger.querySelector(".ds-nav-account-avatar")).toBeInTheDocument();
    expect(trigger).not.toHaveClass("ds-card");
  });
});
