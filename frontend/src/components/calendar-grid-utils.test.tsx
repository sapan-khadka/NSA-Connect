import { describe, expect, it } from "vitest";

import {
  buildCategoryDots,
  getDayCellSurfaceClass,
  getYearMonthTileClass,
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

  it("styles selected day with green tint and soft elevation", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: true,
      isToday: false,
    });
    expect(className).toContain("bg-[#EAF6F1]");
    expect(className).toContain("border-[#7BB8A8]");
  });

  it("styles today with teal gradient and glow", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: false,
      isToday: true,
    });
    expect(className).toContain("from-[#E7F4F0]");
    expect(className).toContain("0_3px_10px_rgba(2,124,104,0.18)");
  });

  it("combines today and selected treatments when both apply", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: true,
      isToday: true,
    });
    expect(className).toContain("from-[#E7F4F0]");
    expect(className).toContain("bg-[#EAF6F1]");
  });

  it("gives default day cells a raised tile shadow", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: false,
      isToday: false,
    });
    expect(className).toContain("0_3px_8px_rgba(0,0,0,0.04)");
    expect(className).toContain("hover:-translate-y-px");
  });

  it("mutes overflow month days", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: false,
      isSelected: false,
      isToday: false,
    });
    expect(className).toContain("opacity-50");
  });

  it("styles current year month tiles with teal glow", () => {
    const className = getYearMonthTileClass({ isCurrentMonth: true });
    expect(className).toContain("from-[#E7F4F0]");
    expect(className).toContain("rounded-[14px]");
  });

  it("styles regular year month tiles with raised shadow", () => {
    const className = getYearMonthTileClass({ isCurrentMonth: false });
    expect(className).toContain("0_4px_12px_rgba(0,0,0,0.05)");
    expect(className).toContain("hover:-translate-y-0.5");
  });
});
