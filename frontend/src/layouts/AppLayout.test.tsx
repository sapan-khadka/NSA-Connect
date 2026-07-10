import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

describe("AppLayout navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Main nav for general members without Finance", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(sidebar).getByRole("link", { name: "Members" })).toHaveAttribute(
      "href",
      "/members",
    );
    expect(within(sidebar).getByRole("link", { name: "Events" })).toHaveAttribute(
      "href",
      "/events/calendar",
    );
    expect(
      within(sidebar).queryByRole("link", { name: "Finance" }),
    ).not.toBeInTheDocument();
    expect(within(sidebar).getByText("Main")).toBeInTheDocument();
    expect(within(sidebar).getByText("Management")).toBeInTheDocument();
    expect(within(sidebar).getByText("Tools")).toBeInTheDocument();
    expect(within(sidebar).getByText("System")).toBeInTheDocument();
  });

  it("shows only Login and Register for unauthenticated users", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: { member: null, isAuthenticated: false },
    });

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
  });

  it("shows sectioned navigation, profile, and logout for board members", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Finance" })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(within(sidebar).getByRole("link", { name: "AI Assistant" })).toHaveAttribute(
      "href",
      "/assistant",
    );
    expect(within(sidebar).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(within(sidebar).getByRole("button", { name: /Board tools/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /User profile for Test User/i }),
    ).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.getByText("Need help?")).toBeInTheDocument();
  });

  it("shows Finance in Main for treasurer members and preserves board tools", async () => {
    const user = userEvent.setup();

    renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("treasurer"),
        isAuthenticated: true,
      },
    });

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("link", { name: "Finance" })).toHaveAttribute(
      "href",
      "/finance",
    );

    await user.click(within(sidebar).getByRole("button", { name: /Board tools/i }));
    expect(
      within(sidebar).getByRole("link", { name: "Board discussion" }),
    ).toHaveAttribute("href", "/board/discussion");
    expect(
      within(sidebar).getByRole("link", { name: "Meeting minutes" }),
    ).toHaveAttribute("href", "/board/meeting-minutes");
    expect(
      within(sidebar).getByRole("link", { name: "Announcement email" }),
    ).toHaveAttribute("href", "/board/announcement-email");
  });
});
