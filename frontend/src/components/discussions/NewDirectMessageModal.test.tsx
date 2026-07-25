import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as membersApi from "../../lib/members-api";
import { NewDirectMessageModal } from "./NewDirectMessageModal";

vi.mock("../../lib/members-api", async () => {
  const actual = await vi.importActual<typeof membersApi>(
    "../../lib/members-api",
  );
  return {
    ...actual,
    fetchMembers: vi.fn(),
  };
});

describe("NewDirectMessageModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists contacts and starts a message on select", async () => {
    const user = userEvent.setup();
    const onSelectMember = vi.fn().mockResolvedValue(undefined);
    vi.mocked(membersApi.fetchMembers).mockResolvedValue({
      members: [
        {
          id: 1,
          full_name: "You",
          email: "you@semo.edu",
          student_id: "1",
          major: "CS",
          graduation_year: 2027,
          role: "board",
          status: "approved",
          position: "member",
        },
        {
          id: 3,
          full_name: "Alex Member",
          email: "alex@semo.edu",
          student_id: "3",
          major: "CS",
          graduation_year: 2028,
          role: "general",
          status: "approved",
          position: "member",
        },
      ],
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });

    render(
      <NewDirectMessageModal
        open
        currentMemberId={1}
        onClose={() => undefined}
        onSelectMember={onSelectMember}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Alex Member")).toBeInTheDocument();
    });
    expect(screen.queryByText("You")).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Alex Member/i }));
    await waitFor(() => {
      expect(onSelectMember).toHaveBeenCalledWith(3);
    });
  });

  it("filters contacts by search query", async () => {
    const user = userEvent.setup();
    vi.mocked(membersApi.fetchMembers).mockResolvedValue({
      members: [
        {
          id: 3,
          full_name: "Alex Member",
          email: "alex@semo.edu",
          student_id: "3",
          major: "CS",
          graduation_year: 2028,
          role: "general",
          status: "approved",
          position: "member",
        },
        {
          id: 4,
          full_name: "Sam General",
          email: "sam@semo.edu",
          student_id: "4",
          major: "CS",
          graduation_year: 2028,
          role: "general",
          status: "approved",
          position: "member",
        },
      ],
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });

    render(
      <NewDirectMessageModal
        open
        currentMemberId={1}
        onClose={() => undefined}
        onSelectMember={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Alex Member")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Search by name/i), "sam");
    expect(screen.queryByText("Alex Member")).not.toBeInTheDocument();
    expect(screen.getByText("Sam General")).toBeInTheDocument();
  });
});
