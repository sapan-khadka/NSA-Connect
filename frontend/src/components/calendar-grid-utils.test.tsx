import { describe, expect, it } from "vitest";

import {
  buildCategoryDots,
  getDayCellSurfaceClass,
} from "./calendar-grid-utils";

describe("calendar-grid-utils", () => {
  it("builds category dots with festival and overflow", () => {
    const dots = buildCategoryDots(
      ["cultural", "meeting", "fundraiser", "social"],
      true,
    );
    expect(dots).toHaveLength(5);
    expect(dots[4]?.key).toBe("festival");
  });

  it("styles selected day as lifted with accent border", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: true,
      isToday: false,
    });
    expect(className).toContain("border-accent");
    expect(className).toContain("-translate-y-0.5");
  });

  it("styles today with glow ring", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: false,
      isToday: true,
    });
    expect(className).toContain("ring-accent");
    expect(className).not.toContain("border-accent");
  });

  it("mutes overflow month days", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: false,
      isSelected: false,
      isToday: false,
    });
    expect(className).toContain("opacity-40");
  });
});
