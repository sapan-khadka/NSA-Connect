import { describe, expect, it } from "vitest";

import {
  formatSemesterLabel,
  getCurrentSemesterSlug,
  getRecentSemesterOptions,
} from "./semester";

describe("semester helpers", () => {
  it("maps months to semester slugs", () => {
    expect(getCurrentSemesterSlug(new Date("2026-03-15"))).toBe("2026-spring");
    expect(getCurrentSemesterSlug(new Date("2026-07-01"))).toBe("2026-summer");
    expect(getCurrentSemesterSlug(new Date("2026-10-01"))).toBe("2026-fall");
  });

  it("formats semester labels", () => {
    expect(formatSemesterLabel("2026-spring")).toBe("Spring 2026");
  });

  it("returns recent semester options in descending order", () => {
    const options = getRecentSemesterOptions(3, new Date("2026-03-15"));

    expect(options).toEqual(["2026-spring", "2025-fall", "2025-summer"]);
  });
});
