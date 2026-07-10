import { describe, expect, it } from "vitest";

import { formatRelativeTimestamp } from "./format-datetime";

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
