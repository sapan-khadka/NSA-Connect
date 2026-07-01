import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalendarCoverHeader } from "./CalendarCoverHeader";

afterEach(() => {
  cleanup();
});

describe("CalendarCoverHeader", () => {
  it("renders decorative wall-calendar elements for the month", () => {
    render(<CalendarCoverHeader year={2030} month={5} />);

    expect(screen.getByTestId("calendar-cover-header")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-spiral-binding")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-stripe-bar")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-cover-year")).toHaveTextContent("2030");
    expect(screen.getByTestId("calendar-cover-month")).toHaveTextContent("June");
    expect(screen.getByTestId("calendar-diamond-row")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-folded-corner")).toBeInTheDocument();
  });
});
