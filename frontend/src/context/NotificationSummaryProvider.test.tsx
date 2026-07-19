import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { EMPTY_NOTIFICATION_SUMMARY } from "../lib/notifications-api";
import {
  NotificationSummaryProvider,
  useNotificationSummary,
} from "./NotificationSummaryProvider";

const fetchNotificationSummary = vi.fn();

vi.mock("../lib/notifications-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/notifications-api")>(
    "../lib/notifications-api",
  );
  return {
    ...actual,
    fetchNotificationSummary: (...args: unknown[]) =>
      fetchNotificationSummary(...args),
  };
});

function MenuProbe() {
  const { menuItems, summary } = useNotificationSummary();
  return (
    <div>
      <p>total:{summary.attention_total}</p>
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
  it("exposes attention items in the bell menu", async () => {
    fetchNotificationSummary.mockResolvedValue({
      ...EMPTY_NOTIFICATION_SUMMARY,
      members_pending: 2,
      finance_pending: 1,
      attention_total: 3,
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
      expect(screen.getByText("total:3")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "2 members awaiting approval" }),
    ).toHaveAttribute("href", "/members?tab=pending");
    expect(
      screen.getByRole("link", { name: "1 finance change to review" }),
    ).toHaveAttribute("href", "/finance?tab=approvals");
  });
});
