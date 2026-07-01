import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarMonthYearPicker } from "./CalendarMonthYearPicker";

describe("CalendarMonthYearPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists months and nearby years including next year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));

    render(
      <CalendarMonthYearPicker year={2026} month={5} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("combobox", { name: "Select month" })).toHaveValue(
      "5",
    );
    expect(screen.getByRole("combobox", { name: "Select year" })).toHaveValue(
      "2026",
    );
    expect(
      screen.getByRole("option", { name: "2029" }),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("jumps to a selected month and year", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarMonthYearPicker year={2026} month={5} onChange={onChange} />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Select month" }),
      "0",
    );
    expect(onChange).toHaveBeenCalledWith(2026, 0);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Select year" }),
      String(new Date().getFullYear() + 3),
    );
    expect(onChange).toHaveBeenCalledWith(new Date().getFullYear() + 3, 5);
  });
});
