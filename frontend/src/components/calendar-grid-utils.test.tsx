import { describe, expect, it } from "vitest";

import {
  buildCategoryMarks,
  getDayCellSurfaceClass,
  getYearMonthTileClass,
} from "./calendar-grid-utils";

describe("calendar-grid-utils", () => {
  it("builds category marks with festival and overflow", () => {
    const marks = buildCategoryMarks(
      ["cultural", "meeting", "fundraiser", "social"],
      true,
    );
    expect(marks).toHaveLength(5);
    expect(marks[4]?.key).toBe("festival");
  });

  it("styles selected day as a flat grid cell", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: true,
      isToday: false,
    });
    expect(className).toContain("events-calendar-day-cell");
    expect(className).toContain("is-selected");
    expect(className).not.toContain("bg-transparent");
    expect(className).not.toContain("shadow-[");
    expect(className).not.toContain("translate-y");
  });

  it("styles today as a flat grid cell", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: false,
      isToday: true,
    });
    expect(className).toContain("is-today");
    expect(className).not.toContain("from-[#E7F4F0]");
  });

  it("prefers selected over today when both apply", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: true,
      isToday: true,
    });
    expect(className).toContain("is-selected");
    expect(className).not.toContain("is-today");
  });

  it("keeps default day cells flat without hover lift", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: true,
      isSelected: false,
      isToday: false,
    });
    expect(className).toContain("events-calendar-day-cell");
    expect(className).not.toContain("shadow-[");
    expect(className).not.toContain("translate-y");
  });

  it("marks overflow month days as outside", () => {
    const className = getDayCellSurfaceClass({
      isCurrentMonth: false,
      isSelected: false,
      isToday: false,
    });
    expect(className).toContain("is-outside");
  });

  it("styles current year month tiles with a charcoal hairline", () => {
    const className = getYearMonthTileClass({ isCurrentMonth: true });
    expect(className).toContain("bg-[#fafafa]");
    expect(className).toContain("border-[#171717]");
    expect(className).not.toContain("from-[#E7F4F0]");
    expect(className).not.toContain("shadow-[");
  });

  it("styles regular year month tiles without raised hover", () => {
    const className = getYearMonthTileClass({ isCurrentMonth: false });
    expect(className).toContain("border-[#ebebea]");
    expect(className).not.toContain("shadow-[");
    expect(className).not.toContain("translate-y");
  });
});
