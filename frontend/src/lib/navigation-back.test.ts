import { describe, expect, it } from "vitest";

import {
  canNavigateBackInApp,
  getRouterHistoryIndex,
  resolveBackNavigation,
} from "./navigation-back";

describe("navigation-back", () => {
  it("reads React Router history idx from state", () => {
    expect(getRouterHistoryIndex({ idx: 3 })).toBe(3);
    expect(getRouterHistoryIndex(null)).toBe(0);
    expect(getRouterHistoryIndex({})).toBe(0);
  });

  it("allows in-app back only when idx > 0", () => {
    expect(canNavigateBackInApp({ idx: 0 })).toBe(false);
    expect(canNavigateBackInApp({ idx: 2 })).toBe(true);
  });

  it("prefers history when available else falls back to parent path", () => {
    expect(resolveBackNavigation("/", { idx: 4 })).toEqual({ type: "history" });
    expect(resolveBackNavigation("/events/calendar", { idx: 0 })).toEqual({
      type: "path",
      to: "/events/calendar",
    });
  });
});
