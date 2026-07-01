import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventAttendeesPanel } from "./EventAttendeesPanel";

describe("EventAttendeesPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows summary, grouped attendees, and filters by search", async () => {
    const user = userEvent.setup();

    render(
      <EventAttendeesPanel
        eventName="Spring Social"
        loading={false}
        error={null}
        data={{
          going_count: 1,
          maybe_count: 1,
          not_going_count: 0,
          attendees: [
            {
              member_id: 1,
              full_name: "Alpha Board",
              member_type: "Board member",
              rsvp_status: "going",
            },
            {
              member_id: 2,
              full_name: "Zeta Member",
              member_type: "General member",
              rsvp_status: "maybe",
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("attendee-rsvp-summary")).toHaveTextContent(
      "1 going · 1 maybe · 0 not going",
    );
    expect(screen.getByText("Board members")).toBeInTheDocument();
    expect(screen.getByText("General members")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "Zeta");
    expect(screen.queryByText("Alpha Board")).not.toBeInTheDocument();
    expect(screen.getByText("Zeta Member")).toBeInTheDocument();
  });
});
