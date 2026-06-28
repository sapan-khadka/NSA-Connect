import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

describe("AppLayout navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("hides Finance and Members links for general members", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/member"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("does not show Finance for unauthenticated users", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: { member: null, isAuthenticated: false },
    });

    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
  });

  it("shows Finance and Members links for board members", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/board"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(screen.getByRole("link", { name: "Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });

  it("shows Finance link for treasurer members", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("treasurer"),
        isAuthenticated: true,
      },
    });

    expect(screen.getByRole("link", { name: "Finance" })).toBeInTheDocument();
  });
});
