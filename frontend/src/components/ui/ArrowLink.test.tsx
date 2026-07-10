import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ArrowLink } from "./ArrowLink";

afterEach(() => {
  cleanup();
});

describe("ArrowLink", () => {
  it("renders accent link with arrow suffix", () => {
    render(
      <MemoryRouter>
        <ArrowLink to="/events/calendar">Calendar</ArrowLink>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Calendar" });
    expect(link).toHaveAttribute("href", "/events/calendar");
    expect(link.className).toContain("ds-link");
    expect(link.querySelector("svg")).toBeTruthy();
  });
});
