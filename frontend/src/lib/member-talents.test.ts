import { describe, expect, it } from "vitest";

import {
  formatTalentFilterSummary,
  memberHasAnyTalent,
} from "./member-talents";

describe("member-talents", () => {
  it("matches members with any selected talent", () => {
    expect(
      memberHasAnyTalent({ talents: ["dancing", "singing"] }, ["dancing"]),
    ).toBe(true);
    expect(memberHasAnyTalent({ talents: ["singing"] }, ["dancing"])).toBe(
      false,
    );
    expect(memberHasAnyTalent({ talents: [] }, ["dancing"])).toBe(false);
  });

  it("formats filter summary without awkward grammar", () => {
    expect(formatTalentFilterSummary(["dancing"], 2)).toBe(
      "Showing 2 members · Dancing",
    );
    expect(formatTalentFilterSummary(["dancing", "singing"], 3)).toBe(
      "Showing 3 members · Dancing, Singing",
    );
  });
});
