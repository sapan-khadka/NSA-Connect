import { describe, expect, it } from "vitest";

import {
  getFestivalsOnDate,
  toBikramSambat,
} from "./nepali-calendar";

describe("nepali-calendar", () => {
  it("formats Gregorian dates as short Bikram Sambat labels", () => {
    expect(toBikramSambat("2030-06-01")).toMatch(/\d{1,2} \w+/);
  });

  it("returns Holi on the configured date", () => {
    const festivals = getFestivalsOnDate("2030-03-20");

    expect(festivals).toEqual([{ id: "holi", name: "Holi" }]);
  });

  it("returns Dashain across its multi-day window", () => {
    const start = getFestivalsOnDate("2030-09-26");
    const end = getFestivalsOnDate("2030-10-05");

    expect(start).toEqual([{ id: "dashain", name: "Dashain" }]);
    expect(end).toEqual([{ id: "dashain", name: "Dashain" }]);
  });

  it("returns no festivals on ordinary dates", () => {
    expect(getFestivalsOnDate("2030-06-15")).toEqual([]);
  });
});
