import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider, createMockMember } from "../test/test-utils";
import {
  DiscussionInboxProvider,
  useDiscussionInbox,
} from "./DiscussionInboxProvider";

const fetchDiscussionInbox = vi.fn();

vi.mock("../lib/discussion-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/discussion-api")>(
    "../lib/discussion-api",
  );
  return {
    ...actual,
    fetchDiscussionInbox: (...args: unknown[]) => fetchDiscussionInbox(...args),
  };
});

function InboxProbe({ label }: { label: string }) {
  const { rooms, loading, error } = useDiscussionInbox();
  if (loading) {
    return <p>{label}:loading</p>;
  }
  if (error) {
    return <p>{label}:error</p>;
  }
  return <p>{label}:{rooms.length}</p>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DiscussionInboxProvider", () => {
  it("fetches the inbox once for multiple subscribers", async () => {
    fetchDiscussionInbox.mockResolvedValue({
      rooms: [
        {
          room_id: "board",
          label: "Board",
          event_id: null,
          href: "/discussions/board",
          last_message_preview: "Hello",
          last_message_at: "2026-08-19T12:00:00Z",
          last_message_author: "Ada",
          unread_count: 1,
          unread_display: "1",
          pinned: true,
          pinned_at: "2026-08-01T00:00:00Z",
        },
      ],
    });

    render(
      <MockAuthProvider
        value={{
          member: createMockMember("general"),
          isAuthenticated: true,
        }}
      >
        <DiscussionInboxProvider>
          <InboxProbe label="a" />
          <InboxProbe label="b" />
        </DiscussionInboxProvider>
      </MockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("a:1")).toBeInTheDocument();
    });
    expect(screen.getByText("b:1")).toBeInTheDocument();
    expect(fetchDiscussionInbox).toHaveBeenCalledTimes(1);
  });

  it("does not fetch until a consumer subscribes", async () => {
    fetchDiscussionInbox.mockResolvedValue({ rooms: [] });

    render(
      <MockAuthProvider
        value={{
          member: createMockMember("general"),
          isAuthenticated: true,
        }}
      >
        <DiscussionInboxProvider>
          <p>idle</p>
        </DiscussionInboxProvider>
      </MockAuthProvider>,
    );

    expect(screen.getByText("idle")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchDiscussionInbox).not.toHaveBeenCalled();
    });
  });
});
