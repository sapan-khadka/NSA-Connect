import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  Breadcrumb,
  NotificationMenu,
  ProfileMenu,
  SearchBar,
  Sidebar,
  SidebarItem,
  TopHeader,
} from "../index";

function wrap(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("design-system navigation components", () => {
  it("renders Sidebar with configurable items", () => {
    wrap(
      <Sidebar header={<span>Brand</span>} footer={<span>Footer</span>}>
        <ul>
          <SidebarItem label="Home" to="/" end />
          <SidebarItem label="Events" to="/events" />
        </ul>
      </Sidebar>,
    );

    expect(screen.getByText("Brand")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("composes TopHeader with SearchBar and submits queries", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    wrap(
      <TopHeader
        leading={<button type="button">Menu</button>}
        center={
          <SearchBar placeholder="Search events…" onSearch={onSearch} />
        }
        actions={<span>Actions</span>}
      />,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    const input = screen.getByRole("searchbox", { name: "Search" });
    await user.type(input, "dashain{Enter}");
    expect(onSearch).toHaveBeenCalledWith("dashain");
  });

  it("opens NotificationMenu and ProfileMenu", async () => {
    const user = userEvent.setup();

    wrap(
      <>
        <NotificationMenu
          items={[
            {
              id: "1",
              title: "New announcement",
              to: "/announcements",
              unread: true,
            },
          ]}
          viewAllTo="/announcements"
        />
        <ProfileMenu
          name="Ada Lovelace"
          subtitle="President"
          items={[
            { id: "profile", label: "Account settings", to: "/profile" },
            { id: "logout", label: "Log out", onClick: () => undefined },
          ]}
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: /Notifications/i }));
    expect(
      screen.getByRole("menu", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("New announcement")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Account menu/i }));
    expect(screen.getByRole("menu", { name: "Account" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Account settings" }),
    ).toHaveAttribute("href", "/profile");
  });

  it("renders Breadcrumb with current page", () => {
    wrap(
      <Breadcrumb
        items={[
          { id: "home", label: "Home", to: "/" },
          { id: "events", label: "Events", to: "/events" },
          { id: "detail", label: "Dashain" },
        ]}
      />,
    );

    const crumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumb).toBeInTheDocument();
    expect(
      within(crumb).getByRole("link", { name: "Home" }),
    ).toHaveAttribute("href", "/");
    expect(within(crumb).getByText("Dashain")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
