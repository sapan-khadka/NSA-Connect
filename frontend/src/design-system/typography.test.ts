import { describe, expect, it } from "vitest";

import {
  fontFamilyDisplay,
  fontFamilySans,
  typeClass,
} from "./typography";

describe("typography contract", () => {
  it("keeps Plus Jakarta for UI and Outfit for display helpers", () => {
    expect(fontFamilySans()).toContain("Plus Jakarta Sans");
    expect(fontFamilyDisplay()).toContain("Outfit");
    expect(typeClass.body).toContain("font-sans");
    expect(typeClass.display).toContain("font-display");
    expect(typeClass.heading).toContain("font-display");
    expect(typeClass.title).toContain("font-sans");
    expect(typeClass.number).toContain("font-sans");
  });
});
