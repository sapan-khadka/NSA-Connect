import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationMenu } from "./NotificationMenu";

afterEach(() => {
  cleanup();
});

describe("NotificationMenu", () => {
  it("shows unread badge, relative time, and mark all read", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();

    render(
      <MemoryRouter>
        <NotificationMenu
          items={[
            {
              id: "1",
              title: "New task: Book venue",
              description: "President assigned you a task.",
              unread: true,
              type: "task_assigned",
              createdAt: new Date().toISOString(),
              to: "/events/tasks",
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
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalledOnce();
  });

  it("renders empty state", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NotificationMenu items={[]} emptyMessage="Nothing here yet." />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("calls onItemSelect when an item is activated", async () => {
    const user = userEvent.setup();
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
              type: "announcement",
              to: "/announcements",
            },
          ]}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    );
    await user.click(screen.getByRole("menuitem", { name: /Actionable/i }));
    expect(onItemSelect).toHaveBeenCalledOnce();
    expect(onItemSelect.mock.calls[0]?.[0]?.id).toBe("1");
  });

  it("closes from the header X and dismisses a row without selecting", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onItemSelect = vi.fn();

    render(
      <MemoryRouter>
        <NotificationMenu
          onDismiss={onDismiss}
          onItemSelect={onItemSelect}
          items={[
            {
              id: "9",
              title: "Removable",
              unread: true,
              type: "task_assigned",
              to: "/events/tasks",
            },
          ]}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    );
    expect(screen.getByRole("menu", { name: "Notifications" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove notification" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDismiss.mock.calls[0]?.[0]?.id).toBe("9");
    expect(onItemSelect).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );
    expect(screen.queryByRole("menu", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("shows view-all link when provided", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NotificationMenu
          items={[
            {
              id: "1",
              title: "Note",
              to: "/members",
            },
          ]}
          viewAllTo="/notifications"
          viewAllLabel="View all notifications"
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(
      screen.getByRole("menuitem", { name: "View all notifications" }),
    ).toHaveAttribute("href", "/notifications");
  });
});
