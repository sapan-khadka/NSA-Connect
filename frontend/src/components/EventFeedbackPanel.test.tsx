import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EventFeedback } from "../lib/events-api";

vi.mock("../lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/events-api")>(
    "../lib/events-api",
  );
  return {
    ...actual,
    submitEventFeedback: vi.fn(),
  };
});

import { submitEventFeedback } from "../lib/events-api";
import { EventFeedbackPanel } from "./EventFeedbackPanel";

const mockedSubmit = vi.mocked(submitEventFeedback);

const savedFeedback: EventFeedback = {
  id: 1,
  event_id: 10,
  rating: 4,
  comment: "Really enjoyed it.",
  created_at: "2026-03-18T12:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventFeedbackPanel", () => {
  it("does not render when feedback is not open for submission", () => {
    const { container } = render(
      <EventFeedbackPanel
        eventId={10}
        canSubmitFeedback={false}
        feedback={null}
        onFeedbackChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("submits feedback for a past event", async () => {
    const user = userEvent.setup();
    mockedSubmit.mockResolvedValue(savedFeedback);

    function Wrapper() {
      const [feedback, setFeedback] = useState<EventFeedback | null>(null);
      return (
        <EventFeedbackPanel
          eventId={10}
          canSubmitFeedback
          feedback={feedback}
          onFeedbackChange={setFeedback}
        />
      );
    }

    render(<Wrapper />);

    await user.click(screen.getByRole("button", { name: "Leave feedback" }));
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.type(
      screen.getByPlaceholderText(/What went well/i),
      "Really enjoyed it.",
    );
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledWith(10, {
      rating: 4,
      comment: "Really enjoyed it.",
    }));
    expect(await screen.findByText("Your feedback")).toBeInTheDocument();
  });

  it("edits existing feedback", async () => {
    const user = userEvent.setup();
    mockedSubmit.mockResolvedValue({
      ...savedFeedback,
      rating: 5,
      comment: "Even better on reflection.",
    });

    render(
      <EventFeedbackPanel
        eventId={10}
        canSubmitFeedback
        feedback={savedFeedback}
        onFeedbackChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit feedback" }));
    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.clear(screen.getByPlaceholderText(/What went well/i));
    await user.type(
      screen.getByPlaceholderText(/What went well/i),
      "Even better on reflection.",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith(10, {
        rating: 5,
        comment: "Even better on reflection.",
      }),
    );
  });
});
