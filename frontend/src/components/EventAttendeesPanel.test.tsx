import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventAttendeesPanel } from "./EventAttendeesPanel";

describe("EventAttendeesPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a compact summary collapsed by default and expands on toggle", async () => {
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
          no_response_count: 2,
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
            {
              member_id: 3,
              full_name: "No Reply Yet",
              member_type: "General member",
              rsvp_status: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("attendee-rsvp-summary")).toHaveTextContent(
      "1 going · 2 not yet responded",
    );
    expect(screen.queryByText("Board members")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show ⌄" }));

    expect(screen.getByTestId("attendee-rsvp-summary")).toHaveTextContent(
      "1 going · 1 maybe · 0 not going · 2 not yet responded",
    );
    expect(screen.getByText("Board members")).toBeInTheDocument();
    expect(screen.getByText("General members")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export attendee list" }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "Zeta");
    expect(screen.queryByText("Alpha Board")).not.toBeInTheDocument();
    expect(screen.getByText("Zeta Member")).toBeInTheDocument();
  });
});
