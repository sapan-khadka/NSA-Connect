import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { ChatNotificationProvider } from "./ChatNotificationProvider";

const refresh = vi.hoisted(() => vi.fn());
const pushToast = vi.hoisted(() => vi.fn());
const fetchDiscussionWsTicket = vi.hoisted(() =>
  vi.fn(async () => ({ token: "ticket-1", expires_at: "2030-01-01T00:00:00Z" })),
);

vi.mock("./NotificationSummaryProvider", () => ({
  useNotificationSummary: () => ({ refresh }),
}));

vi.mock("./ToastProvider", () => ({
  useToast: () => ({ pushToast }),
}));

vi.mock("../lib/discussion-api", () => ({
  fetchDiscussionWsTicket,
}));

vi.mock("../lib/auth-token", () => ({
  getAccessToken: () => "access-token",
}));

class MockSocket {
  static instances: MockSocket[] = [];

  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readyState = 1;

  constructor(url: string) {
    this.url = url;
    MockSocket.instances.push(this);
  }

  send() {}

  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close"));
  }
}

function renderProvider() {
  return render(
    <MemoryRouter>
      <MockAuthProvider
        value={{
          isAuthenticated: true,
          member: {
            id: 4,
            full_name: "Member",
            email: "member@semo.edu",
            student_id: "4",
            major: "CS",
            graduation_year: 2028,
            role: "general",
            status: "approved",
            position: "member",
          },
        }}
      >
        <ChatNotificationProvider>
          <p>ready</p>
        </ChatNotificationProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

describe("ChatNotificationProvider", () => {
  afterEach(() => {
    cleanup();
    MockSocket.instances = [];
    refresh.mockClear();
    pushToast.mockClear();
    fetchDiscussionWsTicket.mockClear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("refreshes the bell for an announcement without a toast or sound", async () => {
    const notify = vi.fn();
    vi.stubGlobal("WebSocket", MockSocket);
    vi.stubGlobal("Notification", notify);

    renderProvider();

    await waitFor(() => {
      expect(MockSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "inbox_notification",
          notification_id: 9,
          title: "Cultural night",
        }),
      } as MessageEvent);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pushToast).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("still toasts discussion messages", async () => {
    vi.stubGlobal("WebSocket", MockSocket);
    renderProvider();

    await waitFor(() => {
      expect(MockSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "discussion_message",
          title: "New message",
          body: "Hello",
          href: "/discussions/board",
          room_id: "board",
        }),
      } as MessageEvent);
    });

    expect(refresh).toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New message", description: "Hello" }),
    );
  });

  it("reconnects after the notification socket closes", async () => {
    vi.stubGlobal("WebSocket", MockSocket);
    renderProvider();

    await waitFor(() => {
      expect(MockSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockSocket.instances[0].close();
    });

    await waitFor(
      () => {
        expect(MockSocket.instances.length).toBeGreaterThan(1);
      },
      { timeout: 3000 },
    );
    expect(fetchDiscussionWsTicket).toHaveBeenCalledTimes(2);
  });
});
