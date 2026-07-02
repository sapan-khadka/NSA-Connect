import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MeetingAttendancePanel } from "./MeetingAttendancePanel";

const attendance = [
  {
    member_id: 1,
    full_name: "Alex Rivera",
    position: "secretary",
    role: "board",
    status: null,
  },
  {
    member_id: 2,
    full_name: "Board Member",
    position: "member",
    role: "board",
    status: "present" as const,
  },
];

describe("MeetingAttendancePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows read-only attendance for viewers", () => {
    render(
      <MeetingAttendancePanel
        attendance={attendance}
        canManage={false}
        presentCount={1}
        absentCount={0}
        excusedCount={0}
        unmarkedCount={1}
        saving={false}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Board attendance")).toBeInTheDocument();
    const alexRow = screen.getByText("Alex Rivera").closest("li");
    expect(alexRow).not.toBeNull();
    expect(within(alexRow!).getByText("—")).toBeInTheDocument();
    const boardMemberRow = screen.getByText("Board Member").closest("li");
    expect(within(boardMemberRow!).getByText("P")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save attendance" })).not.toBeInTheDocument();
  });

  it("lets the secretary save attendance changes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingAttendancePanel
        attendance={attendance}
        canManage
        presentCount={1}
        absentCount={0}
        excusedCount={0}
        unmarkedCount={1}
        saving={false}
        onSave={onSave}
      />,
    );

    const alexPresentButton = screen.getAllByRole("button", { name: "Present" })[0];
    await user.click(alexPresentButton);
    await user.click(screen.getByRole("button", { name: "Save attendance" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { member_id: 1, status: "present" },
        { member_id: 2, status: "present" },
      ]),
    );
  });
});
