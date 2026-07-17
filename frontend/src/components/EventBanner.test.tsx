import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventBanner } from "./EventBanner";
import { EVENT_TYPE_DOT_CLASS } from "../lib/event-types";

describe("EventBanner", () => {
  it("renders a cover image when provided", () => {
    const { container } = render(
      <EventBanner
        eventType="cultural"
        imageUrl="https://example.com/cover.jpg"
        countdown="3 days left"
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/cover.jpg",
    );
    expect(screen.getByText("Cultural")).toBeInTheDocument();
    expect(screen.getByText("3 days left")).toBeInTheDocument();
    expect(container.querySelector(".event-banner-fill")).toBeNull();
  });

  it("fills with the event type color when cover is missing", () => {
    const { container } = render(
      <EventBanner eventType="meeting" imageUrl={null} />,
    );

    const fill = container.querySelector(".event-banner-fill");
    expect(fill).toBeInTheDocument();
    expect(fill).toHaveClass(EVENT_TYPE_DOT_CLASS.meeting);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Meeting")).toBeInTheDocument();
  });
});
