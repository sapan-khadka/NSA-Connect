import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as discussionApi from "../../lib/discussion-api";
import { DiscussionSharedFilesDrawer } from "./DiscussionSharedFilesDrawer";

vi.mock("../../lib/discussion-api", async () => {
  const actual = await vi.importActual<typeof discussionApi>(
    "../../lib/discussion-api",
  );
  return {
    ...actual,
    fetchDiscussionSharedFiles: vi.fn(),
  };
});

describe("DiscussionSharedFilesDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists shared files and jumps to the message", async () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    vi.mocked(discussionApi.fetchDiscussionSharedFiles).mockResolvedValue({
      total: 1,
      files: [
        {
          id: 11,
          kind: "file",
          file_name: "agenda.pdf",
          content_type: "application/pdf",
          size_bytes: 2048,
          url: "/api/v1/dev-uploads/discussion-attachments/agenda.pdf",
          created_at: "2026-07-30T12:00:00Z",
          message_id: 42,
          author_id: 1,
          author_name: "Mukesh",
        },
      ],
    });

    render(
      <DiscussionSharedFilesDrawer
        open
        roomId="board"
        onClose={onClose}
        onJumpToMessage={onJump}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("agenda.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("1 file")).toBeInTheDocument();
    expect(screen.getByText(/Mukesh/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "View in chat" }));
    expect(onJump).toHaveBeenCalledWith(42);
    expect(onClose).toHaveBeenCalled();
  });
});
