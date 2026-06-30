import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, type ComponentProps } from "vitest";

import { MeetingMinutesEditor } from "./MeetingMinutesEditor";
import { renderWithRouter } from "../test/test-utils";
import type { MeetingMinutes } from "../lib/meetings-api";

const emptyMinutes: MeetingMinutes = {
  raw_notes: "",
  summary: null,
  key_decisions: [],
  action_items: [],
  updated_at: null,
  updated_by_name: null,
};

const draftMinutes: MeetingMinutes = {
  raw_notes: "Election discussion and budget vote.",
  summary: null,
  key_decisions: [],
  action_items: [],
  updated_at: "2030-05-01T19:00:00+00:00",
  updated_by_name: "Apsana",
};

const publishedMinutes: MeetingMinutes = {
  raw_notes: "Election discussion and budget vote.",
  summary: "The board reviewed the election timeline.",
  key_decisions: ["Approve election date."],
  action_items: [
    { task: "Send voter guide", owner: "Secretary", due: "May 15" },
  ],
  updated_at: "2030-05-01T20:00:00+00:00",
  updated_by_name: "Apsana",
};

function renderEditor(
  props: Partial<ComponentProps<typeof MeetingMinutesEditor>> = {},
) {
  const onSaveNotes = vi.fn().mockResolvedValue({
    ...draftMinutes,
    raw_notes: "Updated draft notes.",
    updated_at: "2030-05-01T19:30:00+00:00",
    updated_by_name: "Apsana",
  });
  const onSummarize = vi.fn().mockResolvedValue(publishedMinutes);

  renderWithRouter(
    <MeetingMinutesEditor
      eventName="March board meeting"
      minutes={emptyMinutes}
      canManage
      onSaveNotes={onSaveNotes}
      onSummarize={onSummarize}
      {...props}
    />,
  );

  return { onSaveNotes, onSummarize };
}

describe("MeetingMinutesEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows official minutes placeholder before publish", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "Official minutes" })).toBeInTheDocument();
    expect(screen.getByText("Not published yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Official minutes will appear here after you summarize and publish.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Secretary draft notes" }),
    ).toBeInTheDocument();
  });

  it("saves draft notes and shows success message", async () => {
    const user = userEvent.setup();
    const { onSaveNotes } = renderEditor();

    await user.type(
      screen.getByLabelText("Draft notes"),
      "Notes from the meeting.",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(onSaveNotes).toHaveBeenCalledWith("Notes from the meeting.");
    });

    expect(
      await screen.findByText("Draft saved — board members will be notified."),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("publishes official minutes above draft section", async () => {
    const user = userEvent.setup();
    const { onSummarize } = renderEditor({ minutes: draftMinutes });

    await user.click(
      screen.getByRole("button", { name: "Summarize & publish minutes" }),
    );

    await waitFor(() => {
      expect(onSummarize).toHaveBeenCalledWith(
        "Election discussion and budget vote.",
      );
    });

    expect(
      await screen.findByText("The board reviewed the election timeline."),
    ).toBeInTheDocument();
    expect(screen.getByText("Minutes published")).toBeInTheDocument();
    expect(
      screen.getByText("Official minutes published — board members will be notified."),
    ).toBeInTheDocument();
  });

  it("shows published minutes first and collapses draft notes for board members", () => {
    renderEditor({ minutes: publishedMinutes, canManage: false });

    expect(screen.getByText("The board reviewed the election timeline.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Secretary draft notes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("View secretary's draft notes"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Draft notes")).not.toBeInTheDocument();
  });

  it("requires draft notes before publishing", async () => {
    const user = userEvent.setup();
    const { onSummarize } = renderEditor();

    await user.click(
      screen.getByRole("button", { name: "Summarize & publish minutes" }),
    );

    expect(
      await screen.findByText("Add draft notes before publishing official minutes."),
    ).toBeInTheDocument();
    expect(onSummarize).not.toHaveBeenCalled();
  });
});
