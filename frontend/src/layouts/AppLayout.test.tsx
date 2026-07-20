import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows Main nav for general members without Finance", () => {
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
      within(sidebar).queryByRole("link", { name: "Finance" }),
    ).not.toBeInTheDocument();
    expect(within(sidebar).getByText("Main")).toBeInTheDocument();
    expect(within(sidebar).getByText("Tools")).toBeInTheDocument();
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
    expect(within(sidebar).getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Finance" })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(within(sidebar).getByRole("link", { name: "Assistant" })).toHaveAttribute(
      "href",
      "/assistant",
    );
    expect(within(sidebar).getByRole("button", { name: /Admin/i })).toBeInTheDocument();
  });

  it("shows Finance for treasurer members and preserves admin discussion link", async () => {
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

    await user.click(within(sidebar).getByRole("button", { name: /Admin/i }));
    expect(
      within(sidebar).getByRole("link", { name: "Discussions" }),
    ).toHaveAttribute("href", "/discussions");
    expect(
      within(sidebar).getByRole("link", { name: "Meeting minutes" }),
    ).toHaveAttribute("href", "/board/meeting-minutes");
    expect(
      within(sidebar).getByRole("link", { name: "Announcement email" }),
    ).toHaveAttribute("href", "/board/announcement-email");
  });
});
