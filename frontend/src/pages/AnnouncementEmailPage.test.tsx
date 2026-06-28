import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/ai-api", () => ({
  draftAnnouncementEmail: vi.fn(),
}));

import { draftAnnouncementEmail } from "../lib/ai-api";

const mockedDraftAnnouncementEmail = vi.mocked(draftAnnouncementEmail);

describe("AnnouncementEmailPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires an event name before generating a draft", async () => {
    const user = userEvent.setup();

    renderWithRouter(undefined, {
      initialEntries: ["/board/announcement-email"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.click(screen.getByRole("button", { name: "Generate email draft" }));

    expect(await screen.findByText("Event name is required.")).toBeInTheDocument();
    expect(mockedDraftAnnouncementEmail).not.toHaveBeenCalled();
  });

  it("generates a formatted email draft from the event name", async () => {
    const user = userEvent.setup();

    mockedDraftAnnouncementEmail.mockResolvedValue({
      subject: "You're invited: Dashain Celebration",
      body: [
        "Hi NSA members,",
        "",
        "Join us for Dashain Celebration.",
        "",
        "Best,",
        "NSA Connect",
      ].join("\n"),
    });

    renderWithRouter(undefined, {
      initialEntries: ["/board/announcement-email"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.type(screen.getByLabelText("Event name"), "Dashain Celebration");
    await user.click(screen.getByRole("button", { name: "Generate email draft" }));

    await waitFor(() => {
      expect(mockedDraftAnnouncementEmail).toHaveBeenCalledWith({
        event_name: "Dashain Celebration",
      });
    });

    expect(
      await screen.findByText("You're invited: Dashain Celebration"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Join us for Dashain Celebration/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy full email" })).toBeInTheDocument();
  });

  it("includes optional event details when provided", async () => {
    const user = userEvent.setup();

    mockedDraftAnnouncementEmail.mockResolvedValue({
      subject: "You're invited: Spring Social",
      body: "See you there!",
    });

    renderWithRouter(undefined, {
      initialEntries: ["/board/announcement-email"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.type(screen.getByLabelText("Event name"), "Spring Social");
    await user.click(screen.getByRole("button", { name: "Add details" }));
    await user.selectOptions(screen.getByLabelText("Event type"), "social");
    await user.type(screen.getByLabelText("Date"), "2030-04-12");
    await user.type(screen.getByLabelText("Location"), "Student Center");
    await user.type(
      screen.getByLabelText("Description"),
      "Food, games, and music.",
    );
    await user.click(screen.getByRole("button", { name: "Generate email draft" }));

    await waitFor(() => {
      expect(mockedDraftAnnouncementEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: "Spring Social",
          event_type: "social",
          location: "Student Center",
          description: "Food, games, and music.",
        }),
      );
    });
  });

  it("clears the draft when requested", async () => {
    const user = userEvent.setup();

    mockedDraftAnnouncementEmail.mockResolvedValue({
      subject: "Hello",
      body: "Draft body",
    });

    renderWithRouter(undefined, {
      initialEntries: ["/board/announcement-email"],
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    await user.type(screen.getByLabelText("Event name"), "Test Event");
    await user.click(screen.getByRole("button", { name: "Generate email draft" }));

    expect(await screen.findByText("Draft body")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear draft" }));

    expect(screen.queryByText("Draft body")).not.toBeInTheDocument();
  });
});
