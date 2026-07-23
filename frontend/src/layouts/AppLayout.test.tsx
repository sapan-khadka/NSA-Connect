import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/notifications-api", () => ({
  EMPTY_NOTIFICATION_SUMMARY: {
    members_pending: 0,
    finance_pending: 0,
    suggestions_pending: 0,
    discussions_unread: 0,
    tasks_overdue: 0,
    tasks_due_today: 0,
    tasks_oversight_overdue: 0,
    attention_total: 0,
  },
  EMPTY_INBOX: {
    notifications: [],
    total: 0,
    unread_count: 0,
  },
  fetchNotificationSummary: vi.fn().mockResolvedValue({
    members_pending: 0,
    finance_pending: 0,
    suggestions_pending: 0,
    discussions_unread: 0,
    tasks_overdue: 0,
    tasks_due_today: 0,
    tasks_oversight_overdue: 0,
    attention_total: 0,
  }),
  fetchInboxNotifications: vi.fn().mockResolvedValue({
    notifications: [],
    total: 0,
    unread_count: 0,
  }),
  markInboxNotificationRead: vi.fn(),
  markAllInboxNotificationsRead: vi.fn(),
}));

describe("AppLayout navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Main nav for general members without Treasury", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/"],
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("link", { name: "Home" })).toHaveAttribute(
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
      within(sidebar).queryByRole("link", { name: "Treasury" }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("link", { name: "Finance" }),
    ).not.toBeInTheDocument();
    expect(within(sidebar).getByText("Main")).toBeInTheDocument();
    expect(within(sidebar).getByText("Work")).toBeInTheDocument();
    expect(within(sidebar).getByText("Finance")).toBeInTheDocument();
    expect(within(sidebar).getByText("Admin")).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "href",
      "/events/tasks",
    );
    expect(
      within(sidebar).getByRole("link", { name: "Discussions" }),
    ).toHaveAttribute("href", "/discussions");
    expect(
      within(sidebar).queryByRole("link", { name: "Documents" }),
    ).not.toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Treasury" })).not.toBeInTheDocument();
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
    expect(within(sidebar).getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Treasury" })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(within(sidebar).queryByRole("link", { name: "Assistant" })).toBeNull();
    expect(screen.getByRole("link", { name: /Need help/i })).toHaveAttribute(
      "href",
      "/assistant",
    );
    expect(within(sidebar).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      within(sidebar).getByRole("link", { name: "Roles & Permissions" }),
    ).toHaveAttribute("href", "/members?tab=pending");
    expect(within(sidebar).getByRole("link", { name: "Documents" })).toHaveAttribute(
      "href",
      "/board/meeting-minutes",
    );
    expect(
      within(sidebar).queryByRole("button", { name: /Admin/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Treasury for treasurer members and work discussion/documents links", () => {
    renderWithRouter(undefined, {
      initialEntries: ["/finance"],
      auth: {
        member: createMockMember("treasurer"),
        isAuthenticated: true,
      },
    });

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("link", { name: "Treasury" })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(
      within(sidebar).getByRole("link", { name: "Discussions" }),
    ).toHaveAttribute("href", "/discussions");
    expect(within(sidebar).getByRole("link", { name: "Documents" })).toHaveAttribute(
      "href",
      "/board/meeting-minutes",
    );
    expect(within(sidebar).getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });
});
