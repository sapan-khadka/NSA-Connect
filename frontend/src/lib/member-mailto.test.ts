import { describe, expect, it } from "vitest";

import { memberMailtoHref } from "./member-mailto";

describe("memberMailtoHref", () => {
  it("builds a mailto href for a trimmed email", () => {
    expect(memberMailtoHref("  alex@semo.edu ")).toBe("mailto:alex@semo.edu");
  });

  it("returns null when email is missing", () => {
    expect(memberMailtoHref(null)).toBeNull();
    expect(memberMailtoHref("")).toBeNull();
    expect(memberMailtoHref("   ")).toBeNull();
  });
});
