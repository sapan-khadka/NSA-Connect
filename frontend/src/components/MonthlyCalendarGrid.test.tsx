import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthlyCalendarGrid } from "./MonthlyCalendarGrid";

describe("MonthlyCalendarGrid", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders weekday headers and June 2030 days", () => {
    render(
      <MonthlyCalendarGrid year={2030} month={5} onMonthChange={vi.fn()} />,
    );

    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("June 2030")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2030-06-01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2030-06-30" })).toBeInTheDocument();
  });

  it("navigates months via prev and next controls", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();

    render(
      <MonthlyCalendarGrid
        year={2030}
        month={5}
        onMonthChange={onMonthChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onMonthChange).toHaveBeenCalledWith(2030, 4);

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledWith(2030, 6);
  });

  it("renders type-coloured dots and legend", () => {
    render(
      <MonthlyCalendarGrid
        year={2030}
        month={5}
        onMonthChange={vi.fn()}
        events={[
          {
            starts_at: "2030-06-15T18:00:00+00:00",
            event_type: "cultural",
          },
          {
            starts_at: "2030-06-15T20:00:00+00:00",
            event_type: "meeting",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Event type legend")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "2030-06-15, Cultural, Meeting" }),
    ).toBeInTheDocument();

    const dayCell = screen.getByRole("button", {
      name: "2030-06-15, Cultural, Meeting",
    });
    const dots = within(dayCell).getAllByText("", { selector: "span.rounded-full" });
    expect(dots.some((dot) => dot.className.includes("bg-red-500"))).toBe(true);
    expect(dots.some((dot) => dot.className.includes("bg-amber-500"))).toBe(true);
  });

  it("selects a date when clicked", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();

    render(
      <MonthlyCalendarGrid
        year={2030}
        month={5}
        onMonthChange={vi.fn()}
        onSelectDate={onSelectDate}
        events={[
          {
            starts_at: "2030-06-15T18:00:00+00:00",
            event_type: "cultural",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "2030-06-15, Cultural" }),
    );
    expect(onSelectDate).toHaveBeenCalledWith("2030-06-15");
  });
});
