import { describe, expect, it } from "vitest";

import { getAppHeaderMeta } from "./app-header-meta";

describe("getAppHeaderMeta", () => {
  it("resolves dashboard", () => {
    expect(getAppHeaderMeta("/")).toEqual({
      title: "Dashboard",
      breadcrumbs: [{ id: "dashboard", label: "Dashboard" }],
    });
  });

  it("resolves nested events calendar crumbs", () => {
    const meta = getAppHeaderMeta("/events/calendar");
    expect(meta.title).toBe("Events");
    expect(meta.breadcrumbs.map((item) => item.label)).toEqual([
      "Dashboard",
      "Events",
      "Calendar",
    ]);
  });

  it("resolves settings from profile path", () => {
    expect(getAppHeaderMeta("/profile").title).toBe("Settings");
  });
});
