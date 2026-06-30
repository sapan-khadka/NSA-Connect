import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/ai-api", () => ({
  summarizeMeetingMinutes: vi.fn(),
}));

import { summarizeMeetingMinutes } from "../lib/ai-api";

const mockedSummarizeMeetingMinutes = vi.mocked(summarizeMeetingMinutes);

describe("MeetingMinutesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires notes before summarizing", async () => {
    const user = userEvent.setup();

    renderWithRouter(undefined, {
      initialEntries: ["/board/meeting-minutes"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.click(screen.getByRole("button", { name: "Summarize minutes" }));

    expect(await screen.findByText("Meeting notes are required.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "events calendar" })).toHaveAttribute(
      "href",
      "/events/calendar",
    );
    expect(mockedSummarizeMeetingMinutes).not.toHaveBeenCalled();
  });

  it("shows structured summary with action items", async () => {
    const user = userEvent.setup();

    mockedSummarizeMeetingMinutes.mockResolvedValue({
      summary:
        "The board reviewed spring events.\n\nBudget updates were discussed.",
      key_decisions: [
        "Approve Dashain date for October 12.",
        "Increase catering budget by $150.",
      ],
      action_items: [
        {
          task: "Reserve University Center room",
          owner: "Sapan",
          due: "April 1",
        },
        {
          task: "Send updated budget sheet",
          owner: "Treasurer",
          due: null,
        },
      ],
    });

    renderWithRouter(undefined, {
      initialEntries: ["/board/meeting-minutes"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.type(
      screen.getByLabelText("Meeting title (optional)"),
      "March board meeting",
    );
    await user.type(
      screen.getByLabelText("Raw notes"),
      "dashain oct - sapan reserve room",
    );
    await user.click(screen.getByRole("button", { name: "Summarize minutes" }));

    await waitFor(() => {
      expect(mockedSummarizeMeetingMinutes).toHaveBeenCalledWith({
        notes: "dashain oct - sapan reserve room",
        meeting_title: "March board meeting",
      });
    });

    expect(await screen.findByText("The board reviewed spring events.")).toBeInTheDocument();
    expect(screen.getByText("Budget updates were discussed.")).toBeInTheDocument();
    expect(
      screen.getByText("Approve Dashain date for October 12."),
    ).toBeInTheDocument();
    expect(screen.getByText("Reserve University Center room")).toBeInTheDocument();
    expect(screen.getByText("Sapan")).toBeInTheDocument();
    expect(screen.getByText("April 1")).toBeInTheDocument();
    expect(screen.getByText("Send updated budget sheet")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(1);
  });

  it("clears results when requested", async () => {
    const user = userEvent.setup();

    mockedSummarizeMeetingMinutes.mockResolvedValue({
      summary: "Quick standup recap.",
      key_decisions: [],
      action_items: [],
    });

    renderWithRouter(undefined, {
      initialEntries: ["/board/meeting-minutes"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.type(screen.getByLabelText("Raw notes"), "quick notes");
    await user.click(screen.getByRole("button", { name: "Summarize minutes" }));

    expect(await screen.findByText("Quick standup recap.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear results" }));

    expect(screen.queryByText("Quick standup recap.")).not.toBeInTheDocument();
  });
});
