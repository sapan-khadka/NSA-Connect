import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import {
  EMPTY_INBOX,
  EMPTY_NOTIFICATION_SUMMARY,
} from "../lib/notifications-api";
import {
  NotificationSummaryProvider,
  useNotificationSummary,
} from "./NotificationSummaryProvider";

const fetchNotificationSummary = vi.fn();
const fetchInboxNotifications = vi.fn();

vi.mock("../lib/notifications-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/notifications-api")>(
    "../lib/notifications-api",
  );
  return {
    ...actual,
    fetchNotificationSummary: (...args: unknown[]) =>
      fetchNotificationSummary(...args),
    fetchInboxNotifications: (...args: unknown[]) =>
      fetchInboxNotifications(...args),
    markInboxNotificationRead: vi.fn(),
    markAllInboxNotificationsRead: vi.fn(),
  };
});

function MenuProbe() {
  const { menuItems, unreadCount } = useNotificationSummary();
  return (
    <div>
      <p>unread:{unreadCount}</p>
      <ul>
        {menuItems.map((item) => (
          <li key={item.id}>
            <a href={item.to}>{item.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationSummaryProvider", () => {
  it("uses durable inbox items and unread count for the bell", async () => {
    fetchNotificationSummary.mockResolvedValue({
      ...EMPTY_NOTIFICATION_SUMMARY,
      members_pending: 2,
      attention_total: 2,
    });
    fetchInboxNotifications.mockResolvedValue({
      ...EMPTY_INBOX,
      total: 1,
      unread_count: 1,
      notifications: [
        {
          id: 42,
          type: "task_assigned",
          title: "New task: Book venue",
          body: "President assigned you a task.",
          href: "/events/tasks",
          read_at: null,
          created_at: "2026-07-19T12:00:00Z",
          unread: true,
        },
      ],
    });

    render(
      <MockAuthProvider
        value={{
          isAuthenticated: true,
          member: {
            id: 1,
            full_name: "Board",
            email: "board@semo.edu",
            student_id: "1",
            major: "CS",
            graduation_year: 2028,
            role: "board",
            status: "approved",
            position: "member",
          },
        }}
      >
        <MemoryRouter>
          <NotificationSummaryProvider>
            <MenuProbe />
          </NotificationSummaryProvider>
        </MemoryRouter>
      </MockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("unread:1")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "New task: Book venue" }),
    ).toHaveAttribute("href", "/events/tasks");
  });

  it("shows an empty bell when inbox is empty even if summary has standing work", async () => {
    fetchNotificationSummary.mockResolvedValue({
      ...EMPTY_NOTIFICATION_SUMMARY,
      members_pending: 2,
      attention_total: 2,
    });
    fetchInboxNotifications.mockResolvedValue(EMPTY_INBOX);

    render(
      <MockAuthProvider
        value={{
          isAuthenticated: true,
          member: {
            id: 1,
            full_name: "Board",
            email: "board@semo.edu",
            student_id: "1",
            major: "CS",
            graduation_year: 2028,
            role: "board",
            status: "approved",
            position: "member",
          },
        }}
      >
        <MemoryRouter>
          <NotificationSummaryProvider>
            <MenuProbe />
          </NotificationSummaryProvider>
        </MemoryRouter>
      </MockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("unread:0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
