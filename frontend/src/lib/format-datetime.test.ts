import { describe, expect, it } from "vitest";

import {
  formatCompactRelativeTimestamp,
  formatCountdownBadge,
  formatRelativeTimestamp,
} from "./format-datetime";

describe("formatRelativeTimestamp", () => {
  it("formats recent times relative to now", () => {
    const now = new Date("2030-01-01T12:00:00.000Z");
    expect(
      formatRelativeTimestamp("2030-01-01T11:59:30.000Z", now),
    ).toBe("just now");
    expect(
      formatRelativeTimestamp("2030-01-01T11:50:00.000Z", now),
    ).toBe("10 min ago");
    expect(
      formatRelativeTimestamp("2030-01-01T10:00:00.000Z", now),
    ).toBe("2 hr ago");
  });
});

describe("formatCompactRelativeTimestamp", () => {
  it("uses short stamps for inbox density", () => {
    const now = new Date("2030-01-01T12:00:00.000Z");
    expect(
      formatCompactRelativeTimestamp("2030-01-01T11:59:30.000Z", now),
    ).toBe("now");
    expect(
      formatCompactRelativeTimestamp("2030-01-01T11:50:00.000Z", now),
    ).toBe("10m");
    expect(
      formatCompactRelativeTimestamp("2030-01-01T10:00:00.000Z", now),
    ).toBe("2h");
    expect(
      formatCompactRelativeTimestamp("2029-12-20T12:00:00.000Z", now),
    ).toMatch(/Dec/);
  });
});

describe("formatCountdownBadge", () => {
  const now = new Date("2030-01-01T12:00:00.000Z");

  it("returns Soon for invalid dates", () => {
    expect(formatCountdownBadge("not-a-date", now)).toBe("Soon");
  });

  it("returns Happening now for past or current times", () => {
    expect(formatCountdownBadge("2030-01-01T12:00:00.000Z", now)).toBe(
      "Happening now",
    );
    expect(formatCountdownBadge("2030-01-01T11:00:00.000Z", now)).toBe(
      "Happening now",
    );
  });

  it("returns N days left when more than one full day remains", () => {
    expect(formatCountdownBadge("2030-01-14T12:00:00.000Z", now)).toBe(
      "13 days left",
    );
  });

  it("returns Tomorrow when exactly one full day remains", () => {
    expect(formatCountdownBadge("2030-01-02T12:00:00.000Z", now)).toBe(
      "Tomorrow",
    );
  });

  it("returns N hr left for same-day countdowns with hours remaining", () => {
    expect(formatCountdownBadge("2030-01-01T15:00:00.000Z", now)).toBe(
      "3 hr left",
    );
  });

  it("returns N min left when under one hour remains", () => {
    expect(formatCountdownBadge("2030-01-01T12:25:00.000Z", now)).toBe(
      "25 min left",
    );
  });
});
