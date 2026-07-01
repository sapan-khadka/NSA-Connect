import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalendarCoverHeader } from "./CalendarCoverHeader";

afterEach(() => {
  cleanup();
});

describe("CalendarCoverHeader", () => {
  it("renders a thin accent stripe above the calendar grid", () => {
    render(<CalendarCoverHeader />);

    expect(screen.getByTestId("calendar-accent-stripe")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-accent-stripe")).toHaveClass("bg-accent/50");
  });
});
