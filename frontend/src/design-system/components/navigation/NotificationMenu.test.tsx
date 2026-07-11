import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  groupNotificationsByDate,
  NotificationMenu,
} from "./NotificationMenu";

afterEach(() => {
  cleanup();
});

describe("groupNotificationsByDate", () => {
  const now = new Date("2026-07-10T15:00:00");

  it("groups by Today, Yesterday, and earlier labels", () => {
    const groups = groupNotificationsByDate(
      [
        {
          id: "1",
          title: "Today item",
          createdAt: "2026-07-10T10:00:00",
        },
        {
          id: "2",
          title: "Yesterday item",
          createdAt: "2026-07-09T18:00:00",
        },
        {
          id: "3",
          title: "Older item",
          createdAt: "2026-06-01T12:00:00",
        },
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Jun 1",
    ]);
    expect(groups[0]?.items[0]?.title).toBe("Today item");
  });

  it("sorts newest first across groups", () => {
    const groups = groupNotificationsByDate(
      [
        {
          id: "old",
          title: "Older",
          createdAt: "2026-07-08T12:00:00",
        },
        {
          id: "new",
          title: "Newer",
          createdAt: "2026-07-10T12:00:00",
        },
      ],
      now,
    );

    expect(groups[0]?.label).toBe("Today");
    expect(groups[0]?.items[0]?.id).toBe("new");
  });
});

describe("NotificationMenu", () => {
  it("shows unread badge and mark-all action", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();

    render(
      <MemoryRouter>
        <NotificationMenu
          items={[
            {
              id: "1",
              title: "Unread note",
              unread: true,
              createdAt: "2026-07-10T10:00:00",
            },
          ]}
          unreadCount={1}
          onMarkAllRead={onMarkAllRead}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    );
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Mark all as read/i }));
    expect(onMarkAllRead).toHaveBeenCalledOnce();
  });

  it("renders loading state", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NotificationMenu loading items={[]} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NotificationMenu
          items={[]}
          emptyTitle="Nothing here"
          emptyDescription="Check back later."
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Check back later.")).toBeInTheDocument();
  });

  it("runs per-item action buttons without closing via row activate", async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    const onItemSelect = vi.fn();

    render(
      <MemoryRouter>
        <NotificationMenu
          onItemSelect={onItemSelect}
          items={[
            {
              id: "1",
              title: "Actionable",
              unread: true,
              createdAt: "2026-07-10T10:00:00",
              actions: [
                {
                  id: "mark-read",
                  label: "Mark as read",
                  onClick: onMarkRead,
                },
              ],
            },
          ]}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Mark as read" }));
    expect(onMarkRead).toHaveBeenCalledOnce();
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("menu", { name: "Notifications" }),
    ).toBeInTheDocument();
  });
});
