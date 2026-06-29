import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

describe("AppLayout navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not show Finance and Members links for general members", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/member"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Work/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("shows only Login and Register for unauthenticated users", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: { member: null, isAuthenticated: false },
    });

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Upcoming" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
  });

  it("shows grouped primary navigation and account menu for board members", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Work/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Admin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for Test User" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("shows Finance in the Admin menu for treasurer members", async () => {
    const user = userEvent.setup();

    renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("treasurer"),
        isAuthenticated: true,
      },
    });

    await user.click(screen.getByRole("button", { name: /Admin/i }));
    expect(screen.getByRole("menuitem", { name: "Finance" })).toHaveAttribute(
      "href",
      "/finance",
    );
  });
});
