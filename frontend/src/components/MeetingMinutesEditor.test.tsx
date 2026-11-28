import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  draft_version: null,
};

const noteMinutes: MeetingMinutes = {
  ...emptyMinutes,
  raw_notes: "Election discussion and budget vote.",
  updated_at: "2030-05-01T19:00:00+00:00",
  updated_by_name: "Apsana",
};

const reviewDraft: MeetingMinutes = {
  ...noteMinutes,
  draft_summary: "The board reviewed the election timeline.",
  draft_key_decisions: ["Approved the election date."],
  draft_action_items: [{ task: "Send voter guide", owner: "Secretary", due: "2026-05-15" }],
  draft_version: 3,
  draft_updated_at: "2030-05-01T19:40:00+00:00",
  draft_updated_by_name: "Apsana",
};

const publishedMinutes: MeetingMinutes = {
  ...noteMinutes,
  summary: "The board reviewed the election timeline.",
  key_decisions: ["Approved the election date."],
  action_items: [{ task: "Send voter guide", owner: "Secretary", due: "May 15" }],
  published_at: "2030-05-01T20:00:00+00:00",
  updated_at: "2030-05-01T20:00:00+00:00",
  updated_by_name: "Apsana",
};

function renderEditor(
  props: Partial<ComponentProps<typeof MeetingMinutesEditor>> = {},
) {
  const onSaveNotes = vi.fn().mockResolvedValue({
    ...noteMinutes,
    raw_notes: "Updated draft notes.",
  });
  const onGenerate = vi.fn().mockResolvedValue(reviewDraft);
  const onSaveDraft = vi.fn().mockImplementation(async (draft) => ({
    ...reviewDraft,
    draft_summary: draft.summary,
    draft_key_decisions: draft.key_decisions,
    draft_action_items: draft.action_items,
    draft_version: (props.minutes?.draft_version ?? 0) + 1,
  }));
  const onPublish = vi.fn().mockResolvedValue(publishedMinutes);

  renderWithRouter(
    <MeetingMinutesEditor
      eventName="March board meeting"
      minutes={emptyMinutes}
      canManage
      onSaveNotes={onSaveNotes}
      onGenerate={onGenerate}
      onSaveDraft={onSaveDraft}
      onPublish={onPublish}
      {...props}
    />,
  );

  return { onSaveNotes, onGenerate, onSaveDraft, onPublish };
}

describe("MeetingMinutesEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("saves notes without publishing minutes", async () => {
    const user = userEvent.setup();
    const { onSaveNotes, onPublish } = renderEditor({ mode: "notes" });

    await user.type(screen.getByLabelText("Minutes notes"), "Notes from the meeting.");
    await user.click(screen.getByRole("button", { name: "Save notes" }));

    await waitFor(() => {
      expect(onSaveNotes).toHaveBeenCalledWith("Notes from the meeting.");
    });
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("asks before regenerating over an existing draft", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    const { onGenerate } = renderEditor({ minutes: reviewDraft, mode: "notes" });

    await user.click(screen.getByRole("button", { name: "Generate AI minutes" }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("saves draft edits and restores them on cancel", async () => {
    const user = userEvent.setup();
    const { onSaveDraft } = renderEditor({ minutes: reviewDraft, mode: "summary" });

    const overview = screen.getByLabelText("Overview");
    await user.clear(overview);
    await user.type(overview, "Edited overview.");
    await user.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(overview).toHaveValue("The board reviewed the election timeline.");

    await user.clear(overview);
    await user.type(overview, "Edited overview.");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "Edited overview.",
          base_draft_version: 3,
        }),
      );
    });
  });

  it("publishes the reviewed draft", async () => {
    const user = userEvent.setup();
    const { onPublish } = renderEditor({ minutes: reviewDraft, mode: "summary" });

    await user.click(screen.getByRole("button", { name: "Publish minutes" }));

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith(3);
    });
    expect(await screen.findByText("Minutes published. Board members will be notified.")).toBeInTheDocument();
  });

  it("hides unpublished drafts from members who cannot manage minutes", () => {
    renderEditor({
      minutes: {
        ...publishedMinutes,
        draft_summary: "Secret replacement",
        draft_version: 4,
      },
      canManage: false,
      mode: "summary",
    });

    expect(screen.getByText("The board reviewed the election timeline.")).toBeInTheDocument();
    expect(screen.queryByText("Secret replacement")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("minutes-draft-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("minutes-review-layout")).not.toHaveClass("lg:grid-cols-2");
    expect(screen.getByRole("region", { name: "Official meeting minutes" }).querySelector(".grid")).toHaveClass("xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]");
  });

  it("stacks the editor on small screens and places it beside published minutes on desktop", () => {
    renderEditor({ minutes: publishedMinutes, mode: "summary" });

    const layout = screen.getByTestId("minutes-review-layout");
    expect(layout.className).toContain("grid-cols-1");
    expect(layout.className).toContain("lg:grid-cols-2");

    const task = screen.getByLabelText("Task");
    expect(task.closest("div.min-w-0")?.parentElement?.className).toContain("grid-cols-1");
    expect(task.closest("div.min-w-0")?.parentElement?.className).toContain("sm:grid-cols-");
    expect(screen.getByRole("button", { name: "Publish minutes" }).className).not.toContain(
      "w-[",
    );
  });
});
