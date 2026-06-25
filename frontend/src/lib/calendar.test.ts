import { describe, expect, it } from "vitest";

import {
  addMonths,
  buildMonthGrid,
  getDaysInMonth,
  getFirstWeekday,
  isSameDay,
  toLocalIsoDate,
} from "./calendar";

describe("calendar date math", () => {
  it("counts days in month including leap-year February", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
    expect(getDaysInMonth(2023, 1)).toBe(28);
    expect(getDaysInMonth(2024, 3)).toBe(30);
  });

  it("finds weekday of the first day of the month", () => {
    // 1 June 2030 is a Saturday
    expect(getFirstWeekday(2030, 5)).toBe(6);
  });

  it("builds a grid that starts on Sunday and includes adjacent-month padding", () => {
    const cells = buildMonthGrid(2030, 5);

    // June 1 2030 is a Saturday, so the grid opens on Sunday May 26.
    expect(cells[0].isoDate).toBe("2030-05-26");
    expect(cells[6].isoDate).toBe("2030-06-01");
    expect(cells[6].isCurrentMonth).toBe(true);
    expect(cells[cells.length - 1].isoDate).toBe("2030-07-06");
    expect(cells.length % 7).toBe(0);
  });

  it("uses local ISO dates without UTC drift", () => {
    const date = new Date(2030, 5, 1);
    expect(toLocalIsoDate(date)).toBe("2030-06-01");
  });

  it("adds and subtracts months across year boundaries", () => {
    expect(addMonths(2030, 11, 1)).toEqual({ year: 2031, month: 0 });
    expect(addMonths(2030, 0, -1)).toEqual({ year: 2029, month: 11 });
  });

  it("compares calendar days ignoring time", () => {
    const morning = new Date(2030, 5, 15, 9, 0);
    const evening = new Date(2030, 5, 15, 21, 30);
    expect(isSameDay(morning, evening)).toBe(true);
  });
});
