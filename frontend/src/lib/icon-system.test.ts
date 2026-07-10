import { describe, expect, it } from "vitest";

import {
  ICON_SIZE_CLASS,
  ICON_STROKE,
  iconClassName,
} from "./icon-system";

describe("icon-system", () => {
  it("exposes the standard size scale", () => {
    expect(ICON_SIZE_CLASS).toEqual({
      xs: "h-3.5 w-3.5",
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-6 w-6",
      xl: "h-8 w-8",
    });
    expect(ICON_STROKE).toBe(1.75);
  });

  it("builds icon class names with shrink-0", () => {
    expect(iconClassName("sm", "text-label")).toBe(
      "h-4 w-4 shrink-0 text-label",
    );
  });
});
